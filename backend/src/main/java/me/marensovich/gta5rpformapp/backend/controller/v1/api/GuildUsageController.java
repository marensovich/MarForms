package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.service.billing.PlanLimitService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * A guild's plan and its usage of each limited metric (E4.1, #95), for the
 * owner's panel.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequiredArgsConstructor
public class GuildUsageController {

    private final PlanLimitService planLimitService;

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @GetMapping("/api/v1/guilds/{guildId}/usage")
    public PlanLimitService.GuildUsage usage(@PathVariable Long guildId) {
        return planLimitService.usage(guildId);
    }
}
