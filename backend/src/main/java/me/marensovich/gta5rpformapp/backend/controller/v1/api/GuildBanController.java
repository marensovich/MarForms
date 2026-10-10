package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.dto.ban.BanDto;
import me.marensovich.gta5rpformapp.backend.dto.ban.BanRequest;
import me.marensovich.gta5rpformapp.backend.service.BanListService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * A guild's ban list (E2.2, task #68). The owner and moderators manage it:
 * moderators already decide on submissions, and banning a spammer is part
 * of the same job (spec раздел 2 allows narrowing this to Owner later).
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/guilds/{guildId}/bans")
@RequiredArgsConstructor
public class GuildBanController {

    private final BanListService banListService;

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'MODERATOR')")
    @GetMapping
    public List<BanDto> list(@PathVariable Long guildId) {
        return banListService.list(guildId);
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'MODERATOR')")
    @PostMapping
    public ResponseEntity<BanDto> ban(@PathVariable Long guildId, @Valid @RequestBody BanRequest request,
                                      @AuthenticationPrincipal CustomUserDetails principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(banListService.ban(guildId, request, principal.getDiscordId()));
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'MODERATOR')")
    @DeleteMapping("/{discordId}")
    public ResponseEntity<Void> unban(@PathVariable Long guildId, @PathVariable Long discordId) {
        banListService.unban(guildId, discordId);
        return ResponseEntity.noContent().build();
    }
}
