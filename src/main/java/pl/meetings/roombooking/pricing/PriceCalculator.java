package pl.meetings.roombooking.pricing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;

import org.springframework.stereotype.Component;

import pl.meetings.roombooking.room.Room;

@Component
public class PriceCalculator {

    private static final int SCALE = 2;
    private static final BigDecimal MINUTES_PER_HOUR = BigDecimal.valueOf(60);
    private static final BigDecimal WEEKEND_SURCHARGE_RATE = new BigDecimal("0.25");
    private static final BigDecimal LONG_BOOKING_DISCOUNT_RATE = new BigDecimal("0.10");
    private static final BigDecimal LONG_BOOKING_MIN_HOURS = BigDecimal.valueOf(4);

    public PriceQuote quote(Room room, LocalDate date, LocalTime start, LocalTime end) {
        long minutes = Duration.between(start, end).toMinutes();
        BigDecimal hours = BigDecimal.valueOf(minutes).divide(MINUTES_PER_HOUR, SCALE, RoundingMode.HALF_UP);
        BigDecimal basePrice = hours.multiply(room.getPricePerHour()).setScale(SCALE, RoundingMode.HALF_UP);

        BigDecimal weekendSurcharge = zero();
        if (isWeekend(date)) {
            weekendSurcharge = basePrice.multiply(WEEKEND_SURCHARGE_RATE).setScale(SCALE, RoundingMode.HALF_UP);
        }

        BigDecimal discount = zero();
        if (hours.compareTo(LONG_BOOKING_MIN_HOURS) >= 0) {
            discount = basePrice.add(weekendSurcharge)
                    .multiply(LONG_BOOKING_DISCOUNT_RATE)
                    .setScale(SCALE, RoundingMode.HALF_UP);
        }

        BigDecimal totalPrice = basePrice.add(weekendSurcharge).subtract(discount)
                .setScale(SCALE, RoundingMode.HALF_UP);
        return new PriceQuote(hours, basePrice, weekendSurcharge, discount, totalPrice);
    }

    private static boolean isWeekend(LocalDate date) {
        DayOfWeek day = date.getDayOfWeek();
        return day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY;
    }

    private static BigDecimal zero() {
        return BigDecimal.ZERO.setScale(SCALE, RoundingMode.HALF_UP);
    }
}
