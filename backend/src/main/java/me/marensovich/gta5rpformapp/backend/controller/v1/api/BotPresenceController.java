package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.service.BotProfileService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The bot's status (2026-10-19): one for every server, so the platform's
 * administrators set it, not a server's owners.
 *
 * @author marensovich
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/settings/bot-presence")
@RequiredArgsConstructor
public class BotPresenceController {

    private final BotProfileService botProfileService;

    @GetMapping
    @PreAuthorize("hasAuthority('SYSTEM_ADMIN')")
    public BotProfileService.Presence get() {
        return botProfileService.presence();
    }

    @PutMapping
    @PreAuthorize("hasAuthority('SYSTEM_ADMIN')")
    public BotProfileService.Presence update(@RequestBody BotProfileService.Presence presence) {
        return botProfileService.setPresence(presence);
    }
}
