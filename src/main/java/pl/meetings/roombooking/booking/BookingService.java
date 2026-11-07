package pl.meetings.roombooking.booking;

import java.time.LocalDate;
import java.util.List;

import pl.meetings.roombooking.pricing.PriceQuote;

public interface BookingService {

    List<BookingResponse> findByDate(LocalDate date, Long roomId, String ownerEmail);

    BookingResponse getById(Long id, String ownerEmail);

    List<BookingResponse> findMine(String ownerEmail);

    PriceQuote quote(BookingRequest request);

    BookingResponse create(BookingRequest request, String ownerEmail);

    CancellationResponse cancel(Long id, String ownerEmail);

    List<AvailabilitySlot> availability(Long roomId, LocalDate date);
}
