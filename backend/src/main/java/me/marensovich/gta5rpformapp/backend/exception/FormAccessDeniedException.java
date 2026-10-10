package me.marensovich.gta5rpformapp.backend.exception;

/**
 * A logged-in respondent may not fill a form in: not a member of the
 * form's server, or on its ban list. Rendered as 403 with the message
 * itself, unlike a generic {@code AccessDeniedException}, so the
 * respondent learns why.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public class FormAccessDeniedException extends RuntimeException {

    public FormAccessDeniedException(String message) {
        super(message);
    }
}
