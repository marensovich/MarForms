package me.marensovich.gta5rpformapp.backend.config;

/**
 * Cookie names shared by the OAuth success handler and the auth endpoints.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public final class AuthCookies {

    /** Binds a sign-in code to the browser that completed Discord OAuth. */
    public static final String LOGIN_NONCE = "mf_login_nonce";

    private AuthCookies() {
    }
}
