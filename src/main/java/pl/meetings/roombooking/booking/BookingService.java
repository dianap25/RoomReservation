package pl.meetings.roombooking.booking;

import java.time.LocalDate;
import java.util.List;

import pl.meetings.roombooking.pricing.PriceQuote;

public interface BookingService {

    List<BookingResponse> findByDate(LocalDate date, Long roomId);

    BookingResponse getById(Long id);

    List<BookingResponse> findByOrganizer(String email);

    PriceQuote quote(BookingRequest request);

    BookingResponse create(BookingRequest request);

    CancellationResponse cancel(Long id);

    List<AvailabilitySlot> availability(Long roomId, LocalDate date);
}
