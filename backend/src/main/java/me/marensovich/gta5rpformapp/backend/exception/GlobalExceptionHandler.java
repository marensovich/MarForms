package me.marensovich.gta5rpformapp.backend.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Global exception handler for the application.
 * <p>
 * Provides centralized exception handling across all controllers,
 * returning consistent error responses to the client.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Handles {@link NotFoundException} when a requested resource is not found.
     *
     * @param ex the exception containing the error message
     * @return a {@link ResponseEntity} with status 404 (Not Found) and the error message
     * @since v.0.1
     */
    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(NotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", ex.getMessage()));
    }

    /**
     * Handles {@link AccessDeniedException} when a user lacks required permissions.
     *
     * @param ex the access denied exception
     * @return a {@link ResponseEntity} with status 403 (Forbidden) and a generic error message
     * @since v.0.1
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "You don't have permission to perform this action"));
    }

    /**
     * Handles {@link MethodArgumentNotValidException} for validation failures.
     * <p>
     * Returns a map of field names to validation error messages.
     * </p>
     *
     * @param ex the validation exception containing binding result errors
     * @return a {@link ResponseEntity} with status 400 (Bad Request) and field-specific error messages
     * @since v.0.1
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(err ->
                errors.put(err.getField(), err.getDefaultMessage())
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errors);
    }

    /**
     * Handles {@link IllegalArgumentException} for invalid arguments.
     *
     * @param ex the exception containing the error message
     * @return a {@link ResponseEntity} with status 400 (Bad Request) and the error message
     * @since v.0.1
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", ex.getMessage()));
    }
}