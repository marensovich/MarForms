package me.marensovich.gta5rpformapp.backend.exception;

/**
 * The action needs a logged-in user, but the request carries none — e.g.
 * submitting an {@code AUTHENTICATED} form without a session. Rendered as
 * 401 so the client knows to start the Discord login flow.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public class LoginRequiredException extends RuntimeException {

    public LoginRequiredException(String message) {
        super(message);
    }
}
