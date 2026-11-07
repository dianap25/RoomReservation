package pl.meetings.roombooking.booking;

import java.math.BigDecimal;

public record CancellationResponse(Long bookingId, BigDecimal cancellationFee, BigDecimal refund) {
}
