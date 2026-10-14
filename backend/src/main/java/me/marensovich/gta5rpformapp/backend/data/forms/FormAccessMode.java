package me.marensovich.gta5rpformapp.backend.data.forms;

/**
 * Who may fill a form in.
 * <ul>
 *     <li>{@link #OPEN} — no login required; a respondent may still log in
 *     voluntarily. <b>Not</b> the same as {@link #ANONYMOUS}: an open form
 *     records the respondent's identity whenever they are logged in.</li>
 *     <li>{@link #AUTHENTICATED} — Discord login required, and the
 *     respondent must be a member of the form's guild (the original
 *     behaviour, and the default).</li>
 *     <li>{@link #ROLE_GATED} — as {@link #AUTHENTICATED}, plus the form's
 *     RoleGate: the respondent needs one of the allowed Discord roles (if
 *     any are set) and none of the denied ones; deny wins (E2.1).</li>
 *     <li>{@link #ANONYMOUS} — no login, and identity is deliberately never
 *     recorded, even for a logged-in respondent (E2.3, spec раздел 5.6).</li>
 * </ul>
 *
 * @since v.0.1
 */
public enum FormAccessMode {
    OPEN,
    AUTHENTICATED,
    ROLE_GATED,
    ANONYMOUS
}
