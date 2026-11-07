package pl.meetings.roombooking.booking;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import pl.meetings.roombooking.common.BookingAccessDeniedException;
import pl.meetings.roombooking.common.BookingConflictException;
import pl.meetings.roombooking.common.BookingNotFoundException;
import pl.meetings.roombooking.common.BookingRuleViolationException;
import pl.meetings.roombooking.common.RoomNotFoundException;
import pl.meetings.roombooking.common.TimeProvider;
import pl.meetings.roombooking.pricing.PriceCalculator;
import pl.meetings.roombooking.pricing.PriceQuote;
import pl.meetings.roombooking.room.Room;
import pl.meetings.roombooking.room.RoomRepository;
import pl.meetings.roombooking.user.AppUser;
import pl.meetings.roombooking.user.UserService;

@Service
public class BookingServiceImpl implements BookingService {

    private static final int MIN_DURATION_MINUTES = 60;
    private static final int MAX_DURATION_MINUTES = 480;
    private static final int SLOT_MINUTES = 30;
    private static final Duration FREE_CANCELLATION_NOTICE = Duration.ofHours(24);
    private static final BigDecimal LATE_CANCELLATION_FEE_RATE = new BigDecimal("0.50");

    private final BookingRepository bookingRepository;
    private final RoomRepository roomRepository;
    private final UserService userService;
    private final PriceCalculator priceCalculator;
    private final TimeProvider timeProvider;

    public BookingServiceImpl(BookingRepository bookingRepository, RoomRepository roomRepository,
            UserService userService, PriceCalculator priceCalculator, TimeProvider timeProvider) {
        this.bookingRepository = bookingRepository;
        this.roomRepository = roomRepository;
        this.userService = userService;
        this.priceCalculator = priceCalculator;
        this.timeProvider = timeProvider;
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> findByDate(LocalDate date, Long roomId, String ownerEmail) {
        List<Booking> bookings = roomId == null
                ? bookingRepository.findByOrganizerEmailIgnoreCaseAndDateOrderByStartTime(ownerEmail, date)
                : bookingRepository.findByOrganizerEmailIgnoreCaseAndRoomIdAndDateOrderByStartTime(
                        ownerEmail, roomId, date);
        return bookings.stream().map(BookingResponse::from).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public BookingResponse getById(Long id, String ownerEmail) {
        return BookingResponse.from(findOwnedBooking(id, ownerEmail));
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> findMine(String ownerEmail) {
        return bookingRepository.findByOrganizerEmailIgnoreCaseOrderByDateAscStartTimeAsc(ownerEmail).stream()
                .map(BookingResponse::from)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PriceQuote quote(BookingRequest request) {
        Room room = findRoom(request.roomId());
        return quoteFor(room, request);
    }

    @Override
    @Transactional
    public BookingResponse create(BookingRequest request, String ownerEmail) {
        Room room = findRoom(request.roomId());
        PriceQuote quote = quoteFor(room, request);
        validateNotInPast(request);
        validateNoOverlap(room, request);
        AppUser organizer = userService.getByEmail(ownerEmail);
        Booking booking = new Booking(room, organizer.getDisplayName(), organizer.getEmail(),
                request.date(), request.startTime(), request.endTime(), request.attendees(),
                BookingStatus.CONFIRMED, quote.totalPrice(), timeProvider.now());
        return BookingResponse.from(bookingRepository.save(booking));
    }

    @Override
    @Transactional
    public CancellationResponse cancel(Long id, String ownerEmail) {
        Booking booking = findOwnedBooking(id, ownerEmail);
        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new BookingRuleViolationException("Rezerwacja jest już anulowana");
        }
        Instant now = timeProvider.now();
        Instant start = startInstant(booking.getDate(), booking.getStartTime());
        if (!start.isAfter(now)) {
            throw new BookingRuleViolationException("Nie można anulować rozpoczętej rezerwacji");
        }
        BigDecimal fee = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        if (Duration.between(now, start).compareTo(FREE_CANCELLATION_NOTICE) < 0) {
            fee = booking.getTotalPrice().multiply(LATE_CANCELLATION_FEE_RATE).setScale(2, RoundingMode.HALF_UP);
        }
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationFee(fee);
        bookingRepository.save(booking);
        return new CancellationResponse(booking.getId(), fee, booking.getTotalPrice().subtract(fee));
    }

    @Override
    @Transactional(readOnly = true)
    public List<AvailabilitySlot> availability(Long roomId, LocalDate date) {
        Room room = findRoom(roomId);
        List<Booking> confirmed = bookingRepository.findByRoomIdAndDateAndStatus(roomId, date, BookingStatus.CONFIRMED);
        long slotCount = Duration.between(room.getOpensAt(), room.getClosesAt()).toMinutes() / SLOT_MINUTES;
        List<AvailabilitySlot> slots = new ArrayList<>();
        for (long i = 0; i < slotCount; i++) {
            LocalTime start = room.getOpensAt().plusMinutes(i * SLOT_MINUTES);
            LocalTime end = start.plusMinutes(SLOT_MINUTES);
            boolean free = confirmed.stream().noneMatch(booking -> overlaps(booking, start, end));
            slots.add(new AvailabilitySlot(start, end, free));
        }
        return slots;
    }

    private PriceQuote quoteFor(Room room, BookingRequest request) {
        validateTimes(request);
        validateOpeningHours(room, request);
        validateCapacity(room, request);
        return priceCalculator.quote(room, request.date(), request.startTime(), request.endTime());
    }

    private Room findRoom(Long roomId) {
        return roomRepository.findById(roomId)
                .orElseThrow(() -> new RoomNotFoundException(String.format("Sala o id %d nie istnieje", roomId)));
    }

    private Booking findBooking(Long id) {
        return bookingRepository.findById(id)
                .orElseThrow(() -> new BookingNotFoundException(String.format("Rezerwacja o id %d nie istnieje", id)));
    }

    private Booking findOwnedBooking(Long id, String ownerEmail) {
        Booking booking = findBooking(id);
        if (!booking.getOrganizerEmail().equalsIgnoreCase(ownerEmail)) {
            throw new BookingAccessDeniedException("Brak dostępu do tej rezerwacji");
        }
        return booking;
    }

    private static void validateTimes(BookingRequest request) {
        LocalTime start = request.startTime();
        LocalTime end = request.endTime();
        if (!start.isBefore(end)) {
            throw new BookingRuleViolationException(
                    "Godzina rozpoczęcia musi być wcześniejsza niż godzina zakończenia");
        }
        if (!isHalfHourAligned(start) || !isHalfHourAligned(end)) {
            throw new BookingRuleViolationException(
                    "Rezerwacja musi zaczynać się i kończyć o pełnej godzinie lub w połowie godziny");
        }
        long minutes = Duration.between(start, end).toMinutes();
        if (minutes < MIN_DURATION_MINUTES || minutes > MAX_DURATION_MINUTES) {
            throw new BookingRuleViolationException("Rezerwacja musi trwać od 1 do 8 godzin");
        }
    }

    private static boolean isHalfHourAligned(LocalTime time) {
        return time.getMinute() == 0 || time.getMinute() == 30;
    }

    private static void validateOpeningHours(Room room, BookingRequest request) {
        if (request.startTime().isBefore(room.getOpensAt()) || request.endTime().isAfter(room.getClosesAt())) {
            throw new BookingRuleViolationException(
                    String.format("Sala jest otwarta w godzinach %s–%s", room.getOpensAt(), room.getClosesAt()));
        }
    }

    private static void validateCapacity(Room room, BookingRequest request) {
        if (request.attendees() > room.getCapacity()) {
            throw new BookingRuleViolationException(
                    String.format("Sala mieści najwyżej %d osób", room.getCapacity()));
        }
    }

    private void validateNotInPast(BookingRequest request) {
        Instant start = startInstant(request.date(), request.startTime());
        if (start.isBefore(timeProvider.now())) {
            throw new BookingRuleViolationException("Nie można rezerwować w przeszłości");
        }
    }

    private void validateNoOverlap(Room room, BookingRequest request) {
        List<Booking> confirmed = bookingRepository.findByRoomIdAndDateAndStatus(
                room.getId(), request.date(), BookingStatus.CONFIRMED);
        for (Booking existing : confirmed) {
            if (overlaps(existing, request.startTime(), request.endTime())) {
                throw new BookingConflictException(String.format(
                        "Sala jest już zarezerwowana w godzinach %s–%s",
                        existing.getStartTime(), existing.getEndTime()));
            }
        }
    }

    private static boolean overlaps(Booking booking, LocalTime start, LocalTime end) {
        return booking.getStartTime().isBefore(end) && start.isBefore(booking.getEndTime());
    }

    private static Instant startInstant(LocalDate date, LocalTime startTime) {
        return date.atTime(startTime).atZone(ZoneId.systemDefault()).toInstant();
    }
}
