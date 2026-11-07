package pl.meetings.roombooking.booking;

import java.time.LocalDate;
import java.util.List;

public interface AdminBookingService {

    List<BookingResponse> findByDate(LocalDate date);

    List<BookingResponse> findPending();

    BookingResponse confirm(Long id);

    CancellationResponse cancel(Long id);
}
