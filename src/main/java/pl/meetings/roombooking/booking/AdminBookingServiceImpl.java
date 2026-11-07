package pl.meetings.roombooking.booking;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import pl.meetings.roombooking.common.BookingNotFoundException;
import pl.meetings.roombooking.common.BookingRuleViolationException;
import pl.meetings.roombooking.common.TimeProvider;

@Service
public class AdminBookingServiceImpl implements AdminBookingService {

    private final BookingRepository bookingRepository;
    private final TimeProvider timeProvider;

    public AdminBookingServiceImpl(BookingRepository bookingRepository, TimeProvider timeProvider) {
        this.bookingRepository = bookingRepository;
        this.timeProvider = timeProvider;
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> findByDate(LocalDate date) {
        return bookingRepository.findByDateOrderByStartTime(date).stream()
                .map(BookingResponse::from)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> findPending() {
        return bookingRepository.findByStatusOrderByDateAscStartTimeAsc(BookingStatus.PENDING).stream()
                .map(BookingResponse::from)
                .toList();
    }

    @Override
    @Transactional
    public BookingResponse confirm(Long id) {
        Booking booking = findBooking(id);
        if (booking.getStatus() != BookingStatus.PENDING) {
            throw new BookingRuleViolationException("Potwierdzić można tylko rezerwację oczekującą");
        }
        booking.setStatus(BookingStatus.CONFIRMED);
        return BookingResponse.from(bookingRepository.save(booking));
    }

    @Override
    @Transactional
    public CancellationResponse cancel(Long id) {
        Booking booking = findBooking(id);
        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new BookingRuleViolationException("Rezerwacja jest już anulowana");
        }
        Instant start = booking.getDate().atTime(booking.getStartTime()).atZone(ZoneId.systemDefault()).toInstant();
        if (!start.isAfter(timeProvider.now())) {
            throw new BookingRuleViolationException("Nie można anulować rozpoczętej rezerwacji");
        }
        BigDecimal fee = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationFee(fee);
        bookingRepository.save(booking);
        return new CancellationResponse(booking.getId(), fee, booking.getTotalPrice().subtract(fee));
    }

    private Booking findBooking(Long id) {
        return bookingRepository.findById(id)
                .orElseThrow(() -> new BookingNotFoundException(String.format("Rezerwacja o id %d nie istnieje", id)));
    }
}
