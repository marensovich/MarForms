package me.marensovich.gta5rpformapp.backend.exception;

import lombok.Getter;

import java.util.Map;

/**
 * Thrown when a request is structurally valid JSON but its content breaks
 * domain rules — e.g. a form field configuration that makes no sense for
 * its type. Rendered as 400 with a per-field error map
 * (see {@link GlobalExceptionHandler}).
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Getter
public class FieldValidationException extends RuntimeException {

    /**
     * Error message per offending path, e.g. {@code fields[2].options}.
     */
    private final Map<String, String> errors;

    public FieldValidationException(String message, Map<String, String> errors) {
        super(message);
        this.errors = errors;
    }
}
