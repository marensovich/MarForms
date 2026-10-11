package me.marensovich.gta5rpformapp.backend.exception;

/**
 * A request refused because a quota was reached (HTTP 429).
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public class TooManyRequestsException extends RuntimeException {

    public TooManyRequestsException(String message) {
        super(message);
    }
}
