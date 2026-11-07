package pl.meetings.roombooking.room;

import java.math.BigDecimal;
import java.time.LocalTime;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RoomRequest(
        @NotBlank @Size(min = 2, max = 60) String name,
        @Min(1) @Max(500) int capacity,
        @NotNull @DecimalMin("0.01") BigDecimal pricePerHour,
        @NotNull LocalTime opensAt,
        @NotNull LocalTime closesAt) {
}
