package pl.meetings.roombooking.booking;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import pl.meetings.roombooking.common.BookingNotFoundException;
import pl.meetings.roombooking.common.BookingRuleViolationException;
import pl.meetings.roombooking.common.ErrorResponse;

@RestController
@RequestMapping("/api/admin/bookings")
public class AdminBookingController {

    private final AdminBookingService adminBookingService;

    public AdminBookingController(AdminBookingService adminBookingService) {
        this.adminBookingService = adminBookingService;
    }

    @GetMapping
    public List<BookingResponse> findByDate(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return adminBookingService.findByDate(date);
    }

    @GetMapping("/pending")
    public List<BookingResponse> findPending() {
        return adminBookingService.findPending();
    }

    @PostMapping("/{id}/confirm")
    public BookingResponse confirm(@PathVariable Long id) {
        return adminBookingService.confirm(id);
    }

    @PostMapping("/{id}/cancel")
    public CancellationResponse cancel(@PathVariable Long id) {
        return adminBookingService.cancel(id);
    }

    @ExceptionHandler(BookingNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(BookingNotFoundException ex) {
        return error(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(BookingRuleViolationException.class)
    public ResponseEntity<ErrorResponse> handleRuleViolation(BookingRuleViolationException ex) {
        return error(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage());
    }

    private static ResponseEntity<ErrorResponse> error(HttpStatus status, String message) {
        return ResponseEntity.status(status)
                .body(new ErrorResponse(status.value(), status.getReasonPhrase(), message));
    }
}
