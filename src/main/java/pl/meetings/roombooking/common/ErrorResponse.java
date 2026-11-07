package pl.meetings.roombooking.common;

public record ErrorResponse(int status, String error, String message) {
}
