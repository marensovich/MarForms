package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.dto.guild.GuildSettingsDto;
import me.marensovich.gta5rpformapp.backend.service.GuildSettingsService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * A server's settings tab (2026-10-19): admin roles and log channels. The
 * server's owners only — the platform's admins don't set up servers.
 *
 * @author marensovich
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/guilds/{guildId}/settings")
@RequiredArgsConstructor
public class GuildSettingsController {

    private final GuildSettingsService guildSettingsService;
    private final me.marensovich.gta5rpformapp.backend.service.BotProfileService botProfileService;

    /** The admin roles as the client sends them: snowflakes as strings. */
    public record AdminRolesRequest(@NotNull @Size(max = 25) List<@NotNull String> roleIds) {
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @GetMapping
    public GuildSettingsDto get(@PathVariable Long guildId) {
        return guildSettingsService.view(guildId);
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @PutMapping("/admin-roles")
    public GuildSettingsDto setAdminRoles(@PathVariable Long guildId, @Valid @RequestBody AdminRolesRequest request) {
        List<Long> ids;
        try {
            ids = request.roleIds().stream().map(Long::parseLong).toList();
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Role IDs must be numbers");
        }
        return guildSettingsService.setAdminRoles(guildId, ids);
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @PostMapping("/log-channels")
    public GuildSettingsDto createLogChannels(@PathVariable Long guildId) {
        return guildSettingsService.createLogChannels(guildId);
    }

    /** The bot's nickname, avatar, banner and «Обо мне» on the server (2026-10-19). */
    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @GetMapping("/bot")
    public me.marensovich.gta5rpformapp.backend.service.BotProfileService.Profile bot(@PathVariable Long guildId) {
        return botProfileService.profile(guildId);
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @PutMapping("/bot")
    public me.marensovich.gta5rpformapp.backend.service.BotProfileService.Profile updateBot(
            @PathVariable Long guildId, @RequestBody me.marensovich.gta5rpformapp.backend.service.BotProfileService.ProfileChange change) {
        return botProfileService.update(guildId, change);
    }
}
