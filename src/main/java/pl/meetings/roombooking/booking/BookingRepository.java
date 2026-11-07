package pl.meetings.roombooking.booking;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    List<Booking> findByDateOrderByStartTime(LocalDate date);

    List<Booking> findByRoomIdAndDateOrderByStartTime(Long roomId, LocalDate date);

    List<Booking> findByOrganizerEmailIgnoreCaseOrderByDateAscStartTimeAsc(String email);

    List<Booking> findByRoomIdAndDateAndStatus(Long roomId, LocalDate date, BookingStatus status);
}
