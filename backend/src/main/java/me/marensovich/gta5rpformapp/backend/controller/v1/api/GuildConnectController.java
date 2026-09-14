package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.service.GuildMembershipService;
import me.marensovich.gta5rpformapp.backend.service.GuildService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
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
 * point they're recorded as that guild's {@link GuildRole#OWNER}.
 * <p>
 * This is a genuine alternative to typing a raw guild ID by hand in the form
 * wizard (still supported, unchanged) — it also guarantees the bot is
 * actually installed with the right permissions before a form ever
 * references that guild.
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

    /** VIEW_CHANNEL (1&lt;&lt;10) | MANAGE_WEBHOOKS (1&lt;&lt;29) — see product spec раздел 4.1. */
    private static final long BOT_PERMISSIONS = (1L << 10) | (1L << 29);

    private final GuildMembershipService guildMembershipService;
    private final GuildService guildService;
    private final JwtUtil jwtUtil;

    @Value("${spring.security.oauth2.client.registration.discord.client-id}")
    private String discordClientId;

    @Value("${discord.bot-install-redirect-uri:http://localhost:8090/api/v1/guilds/connect/callback}")
    private String botInstallRedirectUri;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    /**
     * Builds the Discord "add bot to server" URL for the current user.
     * <p>
     * Requires the {@code FORMS_MANAGE} authority. The caller's own JWT is
     * round-tripped through Discord as the {@code state} parameter so
     * {@link #callback} can identify who to grant OWNER to — Discord's
     * server-picker screen carries no other information back that would let
     * us know that.
     * </p>
     *
     * @param request the current request, used to read the caller's bearer token
     * @return a map with a single {@code url} key to redirect the browser to
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('FORMS_MANAGE')")
    @GetMapping
    public Map<String, String> connectUrl(HttpServletRequest request) {
        String token = extractBearerToken(request);
        String url = "https://discord.com/oauth2/authorize"
                + "?client_id=" + discordClientId
                + "&scope=" + encode("bot applications.commands")
                + "&permissions=" + BOT_PERMISSIONS
                + "&redirect_uri=" + encode(botInstallRedirectUri)
                + "&state=" + encode(token);
        return Map.of("url", url);
    }

    /**
     * Discord's redirect target after the owner picks a server on the consent
     * screen. No {@code response_type} is requested when building the URL
     * above, so this receives only {@code guild_id} — no authorization code,
     * no token exchange needed.
     *
     * @param guildId  the Discord guild the bot was just added to
     * @param state    the caller's JWT, as passed to {@link #connectUrl}
     * @param response used to redirect the browser back to the frontend
     * @throws IOException if the redirect itself fails
     * @since v.0.1
     */
    @GetMapping("/callback")
    public void callback(
            @RequestParam(name = "guild_id", required = false) Long guildId,
            @RequestParam(required = false) String state,
            HttpServletResponse response
    ) throws IOException {
        if (guildId == null || state == null || !jwtUtil.validateToken(state)) {
            log.warn("Bot-install callback missing/invalid guild_id or state");
            response.sendRedirect(frontendUrl + "/dashboard?guildConnectError=1");
            return;
        }

        Long discordId = jwtUtil.getUserIdFromToken(state);
        guildMembershipService.ensureMembership(discordId, guildId, GuildRole.OWNER);
        // Reinstalling on a guild the bot was previously kicked from must
        // flip its status back — getOrCreate() (called by ensureMembership)
        // only sets it on first creation, not on every call.
        guildService.markConnected(guildId);

        response.sendRedirect(frontendUrl + "/dashboard?connectedGuild=" + guildId);
    }

    private String extractBearerToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        throw new IllegalStateException("Missing Authorization header");
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
