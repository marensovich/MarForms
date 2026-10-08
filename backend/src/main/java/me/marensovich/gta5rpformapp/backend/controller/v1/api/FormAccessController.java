package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.service.FormService;
import me.marensovich.gta5rpformapp.backend.service.GuildMembershipService;
import me.marensovich.gta5rpformapp.backend.service.UserService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * REST controller for checking form access permissions.
 * <p>
 * Provides an endpoint to verify whether the authenticated user has access
 * to a specific form based on their Discord server membership.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/forms/{formId}/access")
@RequiredArgsConstructor
public class FormAccessController {

    private final FormService formService;
    private final GuildMembershipService guildMembershipService;
    private final UserService userService;

    /**
     * Checks if the authenticated user has access to the specified form.
     * <p>
     * Determines access by verifying that the user is a member of the Discord
     * server (guild) associated with the form.
     * </p>
     *
     * @param formId    the UUID of the form to check
     * @param principal the currently authenticated user details
     * @return a {@link Map} containing a boolean value under the key "hasAccess",
     * indicating whether the user has access to the form
     * @since v.0.1
     */
    @GetMapping
    public Map<String, Boolean> checkAccess(
            @PathVariable UUID formId,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        var form = formService.getById(formId);
        var user = principal.getUser();
        boolean hasAccess = user.isMemberOfGuild(form.getServerId());

        // The guild list is a login-time snapshot — the user may have joined
        // the server since. Re-check with their stored Discord token (#31).
        if (!hasAccess && userService.resyncGuildsWithStoredToken(user)) {
            hasAccess = user.isMemberOfGuild(form.getServerId());
        }

        if (hasAccess) {
            guildMembershipService.ensureMembership(
                    principal.getDiscordId(), form.getServerId(), GuildRole.RESPONDENT);
            // Cached for future role gating (#10); refreshed only once the TTL has lapsed.
            guildMembershipService.syncDiscordRolesIfStale(principal.getDiscordId(), form.getServerId());
        }

        return Map.of("hasAccess", hasAccess);
    }
}