package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.dto.audit.GuildAuditEntryDto;
import me.marensovich.gta5rpformapp.backend.service.AuditLogService;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import me.marensovich.gta5rpformapp.backend.database.entity.AuditLog;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * A guild's audit log of moderator actions (E2.5, #77/#78): decisions,
 * moderator changes, bans. The server's staff read it: ТЗ 4.3 keeps only the
 * «Модераторы» and «Тариф» tabs to the owner (#126).
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/guilds/{guildId}/audit-log")
@RequiredArgsConstructor
public class GuildAuditController {

    private final AuditLogService auditLogService;

    /** A page of the feed: entries newest first and where the next page starts ({@code null} at the end). */
    public record Feed(List<GuildAuditEntryDto> items, String nextCursor) {
    }

    /** Someone who acted in the journal. */
    public record Actor(@JsonSerialize(using = ToStringSerializer.class) Long discordId, String username) {
    }

    /**
     * The guild's journal for its feed (ТЗ 4.6), newest first, loaded as the
     * reader scrolls.
     *
     * @param guildId the Discord guild snowflake ID
     * @param action  actions to show (repeatable); none = any
     * @param actorId optional filter by who acted
     * @param days    optional period: the last this many days
     * @param cursor  {@code nextCursor} of the previous page
     * @param size    entries per page, at most 100
     * @return the page
     * @since v.0.1
     */
    @PreAuthorize("@guildAccess.hasRole(#guildId, 'MODERATOR')")
    @GetMapping
    public Feed list(
            @PathVariable Long guildId,
            @RequestParam(required = false) Set<AuditAction> action,
            @RequestParam(required = false) Long actorId,
            @RequestParam(required = false) Integer days,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "30") int size
    ) {
        int limit = Math.max(1, Math.min(size, 100));
        LocalDateTime since = days != null && days > 0 ? LocalDateTime.now().minusDays(days) : null;
        List<AuditLog> rows = auditLogService.feedForGuild(guildId, action, actorId, since, cursor, limit);
        List<AuditLog> page = rows.size() > limit ? rows.subList(0, limit) : rows;
        String next = rows.size() > limit ? AuditLogService.cursorOf(page.get(page.size() - 1)) : null;
        return new Feed(page.stream().map(GuildAuditEntryDto::from).toList(), next);
    }

    /** Everyone who acted in the journal, for the «Кто» filter. */
    @PreAuthorize("@guildAccess.hasRole(#guildId, 'MODERATOR')")
    @GetMapping("/actors")
    public List<Actor> actors(@PathVariable Long guildId) {
        return auditLogService.actorsOfGuild(guildId).stream().map(a -> new Actor(a.getDiscordId(), a.getUsername())).toList();
    }
}
