package pl.meetings.roombooking.security;

import java.io.IOException;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import pl.meetings.roombooking.common.ErrorResponse;

/**
 * Odpowiada 401 z treścią {@link ErrorResponse}. Celowo nie wysyła nagłówka
 * {@code WWW-Authenticate}, żeby przeglądarka nie otwierała własnego okna logowania.
 */
@Component
public class ErrorResponseEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    public ErrorResponseEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException authException) throws IOException {
        String message = authException instanceof BadCredentialsException
                ? "Nieprawidłowy e-mail lub hasło"
                : "Wymagane logowanie";
        HttpStatus status = HttpStatus.UNAUTHORIZED;
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(),
                new ErrorResponse(status.value(), status.getReasonPhrase(), message));
    }
}
