package me.marensovich.gta5rpformapp.backend.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.service.AuthService;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordApiClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Handles successful OAuth2 authentication by processing the OAuth2 user information
 * and redirecting to the frontend with a JWT token.
 * <p>
 * This handler is invoked after a successful Discord OAuth2 login. It extracts the
 * user details and access token, generates a JWT using {@link AuthService},
 * and redirects the user to the frontend application with the JWT as a query parameter.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuthSuccessHandler implements AuthenticationSuccessHandler {

    private final AuthService authService;
    private final OAuth2AuthorizedClientService authorizedClientService;
    private final DiscordApiClient discordApiClient;

    /**
     * Frontend URL to redirect after successful authentication.
     * Loaded from application properties with a default value.
     *
     * @since v.0.1
     */
    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    /**
     * Handles successful OAuth2 authentication.
     * <p>
     * Retrieves the OAuth2 user information, extracts the Discord access token
     * from the authorized client, processes the user through {@link AuthService}
     * to generate a JWT, and redirects to the frontend with the token.
     * </p>
     *
     * @param request        the HTTP request
     * @param response       the HTTP response used for redirection
     * @param authentication the authentication object containing OAuth2 user details
     * @throws IOException if an I/O error occurs during redirection
     * @since v.0.1
     */
    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication
    ) throws IOException {

        OAuth2User oauthUser = (OAuth2User) authentication.getPrincipal();

        String accessToken = null;
        if (authentication instanceof OAuth2AuthenticationToken oauthToken) {
            OAuth2AuthorizedClient client = authorizedClientService.loadAuthorizedClient(
                    oauthToken.getAuthorizedClientRegistrationId(),
                    oauthToken.getName()
            );
            if (client != null) {
                accessToken = client.getAccessToken().getTokenValue();
            }
        }

        String jwt = authService.loginWithDiscord(oauthUser, accessToken);

        response.sendRedirect(frontendUrl + "/auth?token=" + jwt);
    }
}