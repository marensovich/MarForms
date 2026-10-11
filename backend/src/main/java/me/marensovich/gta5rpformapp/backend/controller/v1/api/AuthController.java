package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.AuthCookies;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.service.LoginCodeService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * REST controller for authentication operations.
 * <p>
 * Sign-in only happens through Discord OAuth2 (see {@code OAuthSuccessHandler});
 * there is deliberately no endpoint that issues a token for a bare Discord ID.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final LoginCodeService loginCodeService;

    /** Body of {@link #exchange}. */
    public record ExchangeRequest(String code) {
    }

    /**
     * Exchanges the one-time code from the OAuth redirect for a session token
     * (#103). Needs the HttpOnly cookie set on that redirect.
     *
     * @param request  the code
     * @param nonce    the browser-binding cookie
     * @param response used to clear the cookie
     * @return {@code {"token": ...}}, or 401 for an unknown, used or expired code
     * @since v.0.1
     */
    @PostMapping("/exchange")
    public ResponseEntity<Map<String, String>> exchange(@RequestBody ExchangeRequest request,
                                                        @CookieValue(name = AuthCookies.LOGIN_NONCE, required = false) String nonce,
                                                        HttpServletResponse response) {
        response.addHeader("Set-Cookie", ResponseCookie.from(AuthCookies.LOGIN_NONCE, "")
                .httpOnly(true).sameSite("Lax").path("/api/v1/auth").maxAge(0).build().toString());
        return loginCodeService.exchange(request == null ? null : request.code(), nonce)
                .map(token -> ResponseEntity.ok(Map.of("token", token)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "The sign-in link has expired, please sign in again")));
    }

    /**
     * Signs the current user out on every device: all tokens issued to them
     * so far stop working (#103).
     *
     * @param principal the signed-in user, if any
     * @return 204
     * @since v.0.1
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@AuthenticationPrincipal CustomUserDetails principal) {
        if (principal != null) loginCodeService.revokeAllTokens(principal.getUser());
        return ResponseEntity.noContent().build();
    }
}
