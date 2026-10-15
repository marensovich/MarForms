package me.marensovich.gta5rpformapp.backend.data.forms;

/**
 * Whether a viewer may fill a form in, and if not, why — the access states of
 * ТЗ 3.5 (#110). The codes are part of the API: the public form page shows a
 * screen per code, and refused submissions and uploads carry the same code.
 * <p>
 * Checked in this order; the first failing check wins: platform account →
 * form status → login → server membership → server ban → Discord roles →
 * per-person limit.
 * </p>
 *
 * @since v.0.1
 */
public enum AccessCode {
    GRANTED,
    /** The platform account is banned or in a time-out. */
    ACCOUNT_RESTRICTED,
    /** Published, but the opening time is still ahead. */
    NOT_OPEN_YET,
    /** Closed by staff, or past its closing time. */
    FORM_CLOSED,
    FORM_ARCHIVED,
    /** No such form, or not published yet (drafts are not public). */
    FORM_NOT_FOUND,
    /** Discord login needed. */
    AUTH_REQUIRED,
    NOT_GUILD_MEMBER,
    /** On the server's ban list (E2.2). */
    GUILD_BANNED,
    /** RoleGate: none of the allowed roles. */
    ROLE_REQUIRED,
    /** RoleGate: a denied role — deny wins over allow. */
    ROLE_DENIED,
    /** RoleGate: the roles couldn't be read from Discord; never guessed. */
    ROLE_CHECK_FAILED,
    /** The per-person submission limit is used up. */
    LIMIT_REACHED;

    /**
     * HTTP status of a refused submission or upload with this code.
     *
     * @return 401 for a missing login, 404 for a missing form, 409 for the
     * form's own state, 403 for the rest
     */
    public int httpStatus() {
        return switch (this) {
            case GRANTED -> 200;
            case AUTH_REQUIRED -> 401;
            case FORM_NOT_FOUND -> 404;
            case NOT_OPEN_YET, FORM_CLOSED, FORM_ARCHIVED, LIMIT_REACHED -> 409;
            default -> 403;
        };
    }
}
