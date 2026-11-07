package pl.meetings.roombooking.common;

public class BookingRuleViolationException extends RuntimeException {

    public BookingRuleViolationException(String message) {
        super(message);
    }
}
