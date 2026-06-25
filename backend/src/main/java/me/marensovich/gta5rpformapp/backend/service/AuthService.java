package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordApiClient;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

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
    private final DiscordApiClient discordApiClient;
    private final AuditLogService auditLogService;

    /**
     * Authenticates a user using Discord OAuth2 data.
     * <p>
     * Creates or retrieves the user from the database, syncs their
     * guild memberships if an access token is provided, and generates
     * a JWT token for the session.
     * </p>
     *
     * @param oauthUser          the OAuth2 user data from Discord
     * @param discordAccessToken the user's Discord OAuth2 access token (may be null)
     * @return a JWT token for the authenticated user
     * @since v.0.1
     */
    public String loginWithDiscord(OAuth2User oauthUser, String discordAccessToken) {

        Long discordId = Long.parseLong(oauthUser.getAttribute("id"));
        String username = oauthUser.getAttribute("username");

        User user = userService.findOrCreateDiscordUser(discordId, username);

        if (discordAccessToken != null) {
            userService.syncGuilds(user, discordAccessToken);
        }

        auditLogService.log(AuditAction.USER_LOGIN, user.getDiscordId(), user.getDiscordUsername(),
                null, null, "via Discord OAuth");

        return jwtUtil.generateToken(user.getDiscordId());
    }

    /**
     * Authenticates a user manually using Discord ID and username.
     * <p>
     * Creates or retrieves the user from the database and generates
     * a JWT token without OAuth2 flow. Primarily used for development
     * or fallback authentication.
     * </p>
     *
     * @param discordId the Discord ID of the user
     * @param username  the Discord username of the user
     * @return a JWT token for the authenticated user
     * @since v.0.1
     */
    public String loginWithDiscordManual(Long discordId, String username) {
        User user = userService.findOrCreateDiscordUser(discordId, username);
        auditLogService.log(AuditAction.USER_LOGIN, user.getDiscordId(), user.getDiscordUsername(),
                null, null, "via manual auth");
        return jwtUtil.generateToken(user.getDiscordId());
    }
}