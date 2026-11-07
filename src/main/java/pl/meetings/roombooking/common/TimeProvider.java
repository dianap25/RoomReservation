package pl.meetings.roombooking.common;

import java.time.Clock;
import java.time.Instant;

import org.springframework.stereotype.Component;

@Component
public class TimeProvider {

    private final Clock clock;

    public TimeProvider(Clock clock) {
        this.clock = clock;
    }

    public Instant now() {
        return Instant.now(clock);
    }
}
