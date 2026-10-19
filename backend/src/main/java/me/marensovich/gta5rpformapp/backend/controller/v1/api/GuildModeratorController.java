package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.dto.guild.AddModeratorRequest;
import me.marensovich.gta5rpformapp.backend.dto.guild.ModeratorDto;
import me.marensovich.gta5rpformapp.backend.dto.guild.ModeratorFormsRequest;
import me.marensovich.gta5rpformapp.backend.service.GuildMembershipService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for assigning and removing a guild's moderators (task #60).
 * <p>
 * Owner-only, enforced by the shared {@code guildAccess} guard.
 * See {@link GuildMembershipService#addModerator} for edge-case behaviour
 * (notably: the guild's owner can't be "demoted" to moderator).
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/guilds/{guildId}/moderators")
@RequiredArgsConstructor
public class GuildModeratorController {

    private final GuildMembershipService guildMembershipService;

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @GetMapping
    public List<ModeratorDto> list(@PathVariable Long guildId) {
        return guildMembershipService.listModerators(guildId);
    }

    /** Server members whose name starts with {@code q}, for the «Добавить модератора» picker (ТЗ ФТ-4.7.2). */
    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @GetMapping("/candidates")
    public List<GuildMembershipService.MemberCandidate> candidates(@PathVariable Long guildId,
                                                                   @RequestParam(defaultValue = "") String q) {
        return guildMembershipService.searchMembers(guildId, q);
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @PostMapping
    public ResponseEntity<ModeratorDto> add(@PathVariable Long guildId, @RequestBody AddModeratorRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(guildMembershipService.addModerator(guildId, request));
    }

    /** Which forms the moderator works with: all of them, or only some (#18). */
    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @PutMapping("/{discordId}/forms")
    public ModeratorDto setForms(@PathVariable Long guildId, @PathVariable Long discordId,
                                 @Valid @RequestBody ModeratorFormsRequest request) {
        return guildMembershipService.setModeratorForms(guildId, discordId, request);
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @DeleteMapping("/{discordId}")
    public ResponseEntity<Void> remove(@PathVariable Long guildId, @PathVariable Long discordId) {
        guildMembershipService.removeModerator(guildId, discordId);
        return ResponseEntity.noContent().build();
    }
}
