package me.marensovich.gta5rpformapp.backend.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Sends a failed Discord sign-in back to the SPA's callback page with an error
 * code and a short reference (ТЗ ФТ-3.2.4), instead of Spring's own error page
 * on the API host. The reference is logged with the cause, so support can find it.
 *
 * @author marensovich
 * @since v.0.1
 */
@Slf4j
@Component
public class OAuthFailureHandler implements AuthenticationFailureHandler {

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                        AuthenticationException exception) throws IOException {
        String ref = "%08x".formatted(ThreadLocalRandom.current().nextInt());
        String error = errorCode(exception);
        log.warn("Discord sign-in failed: {} (ref {})", error, ref, exception);
        response.sendRedirect(frontendUrl + "/auth?error=" + error + "&ref=" + ref);
    }

    /**
     * The OAuth2 error code: {@code access_denied} when the user cancelled,
     * {@code authorization_request_not_found} when the attempt expired or came
     * from another browser; anything else is reported as {@code server_error}.
     */
    static String errorCode(AuthenticationException exception) {
        if (exception instanceof OAuth2AuthenticationException oauth) {
            String code = oauth.getError().getErrorCode();
            if (code != null && code.matches("[a-z_]{1,64}")) return code;
        }
        return "server_error";
    }
}
