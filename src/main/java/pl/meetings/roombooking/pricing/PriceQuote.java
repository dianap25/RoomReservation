package pl.meetings.roombooking.pricing;

import java.math.BigDecimal;

public record PriceQuote(
        BigDecimal hours,
        BigDecimal basePrice,
        BigDecimal weekendSurcharge,
        BigDecimal discount,
        BigDecimal totalPrice) {
}
