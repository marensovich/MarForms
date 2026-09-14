package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.dto.guild.GuildMembershipDto;
import me.marensovich.gta5rpformapp.backend.dto.user.MeResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * REST controller for user information endpoints.
 * <p>
 * Provides endpoints for retrieving information about the currently
 * authenticated user.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class UserController {

    private final GuildMembershipRepository guildMembershipRepository;

    /**
     * Retrieves information about the currently authenticated user.
     * <p>
     * Returns the user's Discord ID, username, assigned roles, and permissions.
     * This endpoint is used by the frontend to determine the user's identity
     * and access levels after authentication.
     * </p>
     *
     * @param principal the currently authenticated user details
     * @return a {@link MeResponse} containing user information including a permission hash
     * @since v.0.1
     */
    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal CustomUserDetails principal) {
        Set<Permission> permissions = principal.getPermissions();
        long hash = permissions.stream()
                .mapToLong(p -> p.name().hashCode())
                .sum();

        return new MeResponse(
                principal.getDiscordId(),
                principal.getUser().getDiscordUsername(),
                principal.getUser().getRoles().stream()
                        .map(r -> r.getName())
                        .collect(Collectors.toSet()),
                permissions,
                hash
        );
    }

    /**
     * Retrieves the currently authenticated user's per-guild memberships.
     * <p>
     * Reflects the {@code GuildMembership} rows created lazily as the user
     * creates or accesses forms (see {@code GuildMembershipService}) — this
     * is separate from the global {@link #me} roles/permissions above.
     * </p>
     *
     * @param principal the currently authenticated user details
     * @return the user's guild memberships, most recently recorded first
     * @since v.0.1
     */
    @GetMapping("/me/guilds")
    public List<GuildMembershipDto> myGuilds(@AuthenticationPrincipal CustomUserDetails principal) {
        return guildMembershipRepository.findAllByUser_Id(principal.getUser().getId()).stream()
                .map(GuildMembershipDto::from)
                .sorted((a, b) -> b.since().compareTo(a.since()))
                .collect(Collectors.toList());
    }
}