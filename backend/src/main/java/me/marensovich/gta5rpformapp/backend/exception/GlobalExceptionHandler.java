package me.marensovich.gta5rpformapp.backend.exception;

import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.forms.AccessCode;
import me.marensovich.gta5rpformapp.backend.dto.form.AccessDetailsDto;
import me.marensovich.gta5rpformapp.backend.service.files.FileRules;
import org.springframework.beans.TypeMismatchException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.mapping.PropertyReferenceException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

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
@Slf4j
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
     * Handles an upload above the multipart cap: the request never reached
     * the per-field size check, so say what the platform limit is.
     *
     * @param ex the exception
     * @return a {@link ResponseEntity} with status 413 (Payload Too Large)
     * @since v.0.1
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleUploadTooLarge(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(Map.of("error", "The file is larger than " + FileRules.MAX_SIZE_MB + " MB"));
    }

    /**
     * Handles {@link PlanLimitExceededException}: an owner action over the
     * guild's plan limit (E4.1). 402 with the metric, limit and plan.
     *
     * @param ex the exception
     * @return a {@link ResponseEntity} with status 402 (Payment Required)
     * @since v.0.1
     */
    @ExceptionHandler(org.springframework.dao.OptimisticLockingFailureException.class)
    public ResponseEntity<Map<String, Object>> handleConcurrentUpdate(org.springframework.dao.OptimisticLockingFailureException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", "This was changed elsewhere at the same time — reload and try again"));
    }

    @ExceptionHandler(TooManyRequestsException.class)
    public ResponseEntity<Map<String, Object>> handleTooManyRequests(TooManyRequestsException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(PlanLimitExceededException.class)
    public ResponseEntity<Map<String, Object>> handlePlanLimit(PlanLimitExceededException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage());
        body.put("metric", ex.getMetric().name());
        body.put("limit", ex.getLimit());
        body.put("plan", ex.getPlan().name());
        return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(body);
    }

    /**
     * Handles {@link FormAccessException}: unlike a generic 403, the respondent
     * is told why, with the access code of ТЗ 3.5 and its details (#110).
     *
     * @param ex the exception
     * @return the code's status ({@link AccessCode#httpStatus()}) with error, code and details
     * @since v.0.1
     */
    @ExceptionHandler(FormAccessException.class)
    public ResponseEntity<Map<String, Object>> handleFormAccess(FormAccessException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage());
        body.put("code", ex.getCode().name());
        if (ex.getDetails() != null && !ex.getDetails().equals(AccessDetailsDto.NONE)) body.put("details", ex.getDetails());
        return ResponseEntity.status(ex.getCode().httpStatus()).body(body);
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
    /**
     * A decision on a submission someone already decided (ТЗ ФТ-4.5.6).
     *
     * @param ex the conflict, with who decided and when
     * @return 409 with {@code error}, {@code status}, {@code decidedBy}, {@code decidedAt}
     * @since v.0.1
     */
    @ExceptionHandler(DecisionConflictException.class)
    public ResponseEntity<Map<String, Object>> handleDecisionConflict(DecisionConflictException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage());
        body.put("status", ex.getStatus().name());
        body.put("decidedBy", ex.getDecidedBy());
        body.put("decidedAt", ex.getDecidedAt() != null ? ex.getDecidedAt().toString() : null);
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    /**
     * A form saved elsewhere since it was opened (ТЗ 5.7).
     *
     * @param ex the conflict, with who saved and when
     * @return 409 with {@code error}, {@code updatedBy}, {@code updatedAt}
     * @since v.0.1
     */
    @ExceptionHandler(FormConflictException.class)
    public ResponseEntity<Map<String, Object>> handleFormConflict(FormConflictException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage());
        body.put("updatedBy", ex.getUpdatedBy());
        body.put("updatedAt", ex.getUpdatedAt() != null ? ex.getUpdatedAt().toString() : null);
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(InvalidStateException.class)
    public ResponseEntity<Map<String, String>> handleInvalidState(InvalidStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
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
                .body(Map.of("error", ex.getMessage() != null ? ex.getMessage() : "Invalid request"));
    }

    /**
     * Malformed requests the framework rejects: unreadable JSON, a parameter
     * of the wrong type, an unknown sort property (#103).
     *
     * @param ex the exception
     * @return 400 with a generic message
     * @since v.0.1
     */
    @ExceptionHandler({HttpMessageNotReadableException.class, TypeMismatchException.class,
            PropertyReferenceException.class})
    public ResponseEntity<Map<String, String>> handleBadRequest(Exception ex) {
        String message = ex instanceof PropertyReferenceException p
                ? "Unknown sort property: " + p.getPropertyName()
                : "Malformed request";
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", message));
    }

    /**
     * Anything else: one JSON shape, 500, and a correlation id that is also
     * in the log — instead of whatever the container makes of the exception
     * (#103). Framework exceptions that carry their own status (404 for an
     * unknown path, 405, missing parameters...) keep it.
     *
     * @param ex the exception
     * @return the error response
     * @since v.0.1
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception ex) {
        if (ex instanceof ErrorResponse response) {
            return ResponseEntity.status(response.getStatusCode())
                    .body(Map.of("error", response.getBody().getDetail() != null
                            ? response.getBody().getDetail() : HttpStatus.valueOf(response.getStatusCode().value()).getReasonPhrase()));
        }
        String correlationId = UUID.randomUUID().toString();
        log.error("Unhandled error [{}]", correlationId, ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Something went wrong on our side", "correlationId", correlationId));
    }
}