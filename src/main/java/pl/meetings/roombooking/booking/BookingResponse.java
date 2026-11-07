package pl.meetings.roombooking.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

public record BookingResponse(
        Long id,
        Long roomId,
        String roomName,
        String organizerName,
        String organizerEmail,
        LocalDate date,
        LocalTime startTime,
        LocalTime endTime,
        int attendees,
        BookingStatus status,
        BigDecimal totalPrice,
        BigDecimal cancellationFee) {

    public static BookingResponse from(Booking booking) {
        return new BookingResponse(
                booking.getId(),
                booking.getRoom().getId(),
                booking.getRoom().getName(),
                booking.getOrganizerName(),
                booking.getOrganizerEmail(),
                booking.getDate(),
                booking.getStartTime(),
                booking.getEndTime(),
                booking.getAttendees(),
                booking.getStatus(),
                booking.getTotalPrice(),
                booking.getCancellationFee());
    }
}
