package me.marensovich.gta5rpformapp.backend.exception;

/**
 * Exception thrown when a requested resource is not found in the system.
 * <p>
 * Typically results in an HTTP 404 (Not Found) response.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public class NotFoundException extends RuntimeException {

    /**
     * Constructs a new {@code NotFoundException} with the specified detail message.
     *
     * @param message the detail message explaining the reason for the exception
     * @since v.0.1
     */
    public NotFoundException(String message) {
        super(message);
    }
}