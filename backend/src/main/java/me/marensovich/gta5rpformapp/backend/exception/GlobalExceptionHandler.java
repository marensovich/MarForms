package me.marensovich.gta5rpformapp.backend.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
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
     * Handles {@link FormAccessDeniedException}: unlike a generic 403, the
     * respondent is told why (not a member of the server, banned).
     *
     * @param ex the exception
     * @return a {@link ResponseEntity} with status 403 (Forbidden) and the message
     * @since v.0.1
     */
    @ExceptionHandler(FormAccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleFormAccessDenied(FormAccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
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
     * Handles {@link FieldValidationException} — domain-level validation
     * failures with a per-field breakdown.
     *
     * @param ex the exception carrying the error map
     * @return 400 with {@code {"error": "...", "fields": {path: message}}}
     * @since v.0.1
     */
    @ExceptionHandler(FieldValidationException.class)
    public ResponseEntity<Map<String, Object>> handleFieldValidation(FieldValidationException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage());
        body.put("fields", ex.getErrors());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    /**
     * Handles {@link InvalidStateException} raised for an operation that is
     * not allowed in the resource's current state (e.g. publishing an
     * archived form).
     *
     * @param ex the exception containing the error message
     * @return 409 (Conflict) with the error message
     * @since v.0.1
     */
    @ExceptionHandler(InvalidStateException.class)
    public ResponseEntity<Map<String, String>> handleInvalidState(InvalidStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", ex.getMessage()));
    }

    /**
     * Handles {@link LoginRequiredException}.
     *
     * @param ex the exception containing the error message
     * @return 401 (Unauthorized) with the error message
     * @since v.0.1
     */
    @ExceptionHandler(LoginRequiredException.class)
    public ResponseEntity<Map<String, String>> handleLoginRequired(LoginRequiredException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", ex.getMessage()));
    }

    /**
     * Handles a unique-constraint race — e.g. two identical submissions with
     * the same idempotency key arriving at the same instant. The client's
     * retry then finds the stored row and gets it back normally.
     *
     * @param ex the integrity violation
     * @return 409 (Conflict) with a generic message
     * @since v.0.1
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrity(DataIntegrityViolationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", "This request conflicts with an existing record — please retry"));
    }

    /**
     * Handles a lost optimistic-lock race — e.g. two moderators deciding on
     * the same submission at the same moment (task #53).
     *
     * @param ex the locking failure
     * @return 409 (Conflict) asking the client to reload
     * @since v.0.1
     */
    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<Map<String, String>> handleOptimisticLock(ObjectOptimisticLockingFailureException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", "Someone else just updated this — reload and try again"));
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