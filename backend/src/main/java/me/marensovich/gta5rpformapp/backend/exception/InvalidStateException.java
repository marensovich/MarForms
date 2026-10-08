package me.marensovich.gta5rpformapp.backend.exception;

/**
 * Thrown when an operation is valid in general but not in the target's
 * current state — e.g. submitting to a closed form, or publishing an
 * archived one. Rendered as 409 Conflict with a readable message.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public class InvalidStateException extends RuntimeException {

    public InvalidStateException(String message) {
        super(message);
    }
}
