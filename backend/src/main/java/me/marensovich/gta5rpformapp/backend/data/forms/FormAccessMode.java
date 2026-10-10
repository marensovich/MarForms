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
 *     <li>{@link #ROLE_GATED} — reserved for Stage 2 (E2.1, RoleGate).</li>
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
    ANONYMOUS;

    /**
     * Whether this mode can be selected yet — {@link #ROLE_GATED} exists in
     * the schema so the UI can show it, but has no logic behind it.
     *
     * @return {@code false} only for {@link #ROLE_GATED}
     */
    public boolean isAvailable() {
        return this != ROLE_GATED;
    }
}
