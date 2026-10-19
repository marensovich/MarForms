package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.service.GuildConnectService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * REST controller implementing the bot-install flow (product spec раздел 4.1):
 * the owner clicks "Add to Discord", picks a server on Discord's own consent
 * screen, and is redirected back here with the chosen guild's ID — at which
 * point, once verified, they're recorded as that guild's {@link GuildRole#OWNER}.
 * <p>
 * Nothing in the redirect is trusted on its own (security audit, #103): the
 * {@code state} is a one-time nonce issued by {@link #connectUrl}, and the
 * bot must confirm the installer owns or manages the guild. See
 * {@link GuildConnectService}.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/guilds/connect")
@RequiredArgsConstructor
public class GuildConnectController {

    /** The bot's permissions of ТЗ 7.1: VIEW_CHANNEL, MANAGE_WEBHOOKS. */
    private static final long BOT_PERMISSIONS = net.dv8tion.jda.api.Permission.getRaw(
            me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient.REQUIRED_PERMISSIONS);

    private final GuildConnectService guildConnectService;

    @Value("${spring.security.oauth2.client.registration.discord.client-id}")
    private String discordClientId;

    @Value("${discord.bot-install-redirect-uri:http://localhost:8090/api/v1/guilds/connect/callback}")
    private String botInstallRedirectUri;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    /**
     * Builds the Discord "add bot to server" URL for the current user, with a
     * fresh one-time nonce as {@code state}. Open to any signed-in user: who may
     * connect a guild is decided by Discord in the callback (owner or Manage Server, #151).
     *
     * @param principal the signed-in user
     * @return a map with a single {@code url} key to redirect the browser to
     * @since v.0.1
     */
    @GetMapping
    public Map<String, String> connectUrl(@AuthenticationPrincipal CustomUserDetails principal,
                                          @org.springframework.web.bind.annotation.RequestParam(required = false) Long guildId) {
        String state = guildConnectService.start(principal.getDiscordId());
        String url = "https://discord.com/oauth2/authorize"
                + "?client_id=" + discordClientId
                + "&scope=" + encode("bot applications.commands")
                + "&permissions=" + BOT_PERMISSIONS
                // Discord sends the browser back with guild_id only in the code flow; the
                // redirect_uri must be listed under OAuth2 > Redirects, or Discord answers
                // "Invalid OAuth2 redirect_uri" before the consent screen.
                + "&response_type=code"
                + "&redirect_uri=" + encode(botInstallRedirectUri)
                + "&state=" + encode(state)
                // «Выдать права» / «Пригласить снова» (#124): straight to that server.
                + (guildId != null ? "&guild_id=" + Long.toUnsignedString(guildId) + "&disable_guild_select=true" : "");
        return Map.of("url", url);
    }

    /**
     * Discord's redirect after the bot was added. Public, since it's a
     * browser navigation from Discord with no bearer token.
     *
     * @param guildId  the guild Discord says the bot was added to
     * @param state    the nonce from {@link #connectUrl}
     * @param response used to redirect back to the dashboard
     * @throws IOException if the redirect fails
     * @since v.0.1
     */
    @GetMapping("/callback")
    public void callback(
            @RequestParam(name = "guild_id", required = false) Long guildId,
            @RequestParam(required = false) String state,
            HttpServletResponse response
    ) throws IOException {
        GuildConnectService.Outcome outcome = guildConnectService.complete(state, guildId);
        switch (outcome) {
            case CONNECTED -> response.sendRedirect(frontendUrl + "/dashboard/servers?connectedGuild=" + guildId);
            case NOT_GUILD_MANAGER -> response.sendRedirect(frontendUrl + "/dashboard/servers?guildConnectError=manager");
            case BOT_NOT_IN_GUILD -> response.sendRedirect(frontendUrl + "/dashboard/servers?guildConnectError=bot");
            case INVALID_STATE -> {
                log.warn("Bot-install callback with a missing, unknown or reused state");
                response.sendRedirect(frontendUrl + "/dashboard/servers?guildConnectError=state");
            }
        }
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
