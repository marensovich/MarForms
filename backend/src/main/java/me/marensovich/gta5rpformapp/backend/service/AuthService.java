package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordTokenService;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Service for handling authentication operations.
 * <p>
 * Provides methods for authenticating users via Discord OAuth2 and
 * manual authentication, generating JWT tokens upon successful login.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserService userService;
    private final JwtUtil jwtUtil;
    private final DiscordTokenService discordTokenService;
    private final AuditLogService auditLogService;

    /**
     * The Discord OAuth2 tokens obtained at login.
     *
     * @param accessToken  the access token
     * @param refreshToken the refresh token, may be {@code null}
     * @param expiresAt    when the access token expires, may be {@code null}
     * @param scopes       granted scopes, space-separated
     * @since v.0.1
     */
    public record DiscordTokens(String accessToken, String refreshToken, LocalDateTime expiresAt, String scopes) {
    }

    /**
     * Authenticates a user using Discord OAuth2 data.
     * <p>
     * Creates or retrieves the user from the database, syncs their
     * guild memberships if an access token is provided, and generates
     * a JWT token for the session.
     * </p>
     *
     * <p>
     * The Discord tokens are also stored (encrypted) via
     * {@link DiscordTokenService}, so later calls on the user's behalf work
     * after the access token expires — see task #31.
     * </p>
     *
     * @param oauthUser the OAuth2 user data from Discord
     * @param tokens    the user's Discord OAuth2 tokens (may be null)
     * @return a JWT token for the authenticated user
     * @since v.0.1
     */
    public String loginWithDiscord(OAuth2User oauthUser, DiscordTokens tokens) {

        Long discordId = Long.parseLong(oauthUser.getAttribute("id"));
        String username = oauthUser.getAttribute("username");

        User user = userService.findOrCreateDiscordUser(discordId, username);
        userService.refreshProfile(user, username, oauthUser.getAttribute("avatar"));

        if (tokens != null) {
            discordTokenService.store(user.getId(), tokens.accessToken(), tokens.refreshToken(),
                    tokens.expiresAt(), tokens.scopes());
            userService.syncGuilds(user, tokens.accessToken());
        }

        auditLogService.log(AuditAction.USER_LOGIN, user.getDiscordId(), user.getDiscordUsername(),
                null, null, "via Discord OAuth");

        return jwtUtil.generateToken(user.getDiscordId());
    }
}