package pl.meetings.roombooking.booking;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    List<Booking> findByOrganizerEmailIgnoreCaseAndDateOrderByStartTime(String organizerEmail, LocalDate date);

    List<Booking> findByOrganizerEmailIgnoreCaseAndRoomIdAndDateOrderByStartTime(
            String organizerEmail, Long roomId, LocalDate date);

    List<Booking> findByOrganizerEmailIgnoreCaseOrderByDateAscStartTimeAsc(String organizerEmail);

    List<Booking> findByRoomIdAndDateAndStatus(Long roomId, LocalDate date, BookingStatus status);
}
