package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

    /**
     * Logs out the current user by clearing the JWT cookie.
     * <p>
     * Creates a new cookie with the same name ("jwt"), sets its max age to 0
     * (effectively deleting it), and adds it to the response. This clears the
     * authentication cookie on the client side.
     * </p>
     *
     * @param response the HTTP response used to add the cookie
     * @return a {@link ResponseEntity} containing a success message
     * @since v.0.1
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        Cookie cookie = new Cookie("jwt", null);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
        return ResponseEntity.status(HttpStatus.OK).body(Map.of("message", "Logout Successful!"));
    }
}