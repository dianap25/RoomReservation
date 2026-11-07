package pl.meetings.roombooking.booking;

import java.time.LocalTime;

public record AvailabilitySlot(LocalTime start, LocalTime end, boolean free) {
}
