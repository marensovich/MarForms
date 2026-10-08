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
 *     <li>{@link #ANONYMOUS} — reserved for Stage 2 (E2.3); identity is
 *     deliberately never recorded.</li>
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
     * Whether this mode can be selected yet — the Stage 2 values exist in
     * the schema so the UI can show them, but have no logic behind them.
     *
     * @return {@code true} for {@link #OPEN} and {@link #AUTHENTICATED}
     */
    public boolean isAvailable() {
        return this == OPEN || this == AUTHENTICATED;
    }
}
