package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.dto.audit.GuildAuditEntryDto;
import me.marensovich.gta5rpformapp.backend.service.AuditLogService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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

    /**
     * The guild's audit log, newest first.
     *
     * @param guildId  the Discord guild snowflake ID
     * @param action   optional filter by action
     * @param actorId  optional filter by the acting moderator's Discord ID
     * @param pageable pagination
     * @return the matching entries
     * @since v.0.1
     */
    @PreAuthorize("@guildAccess.hasRole(#guildId, 'MODERATOR')")
    @GetMapping
    public Page<GuildAuditEntryDto> list(
            @PathVariable Long guildId,
            @RequestParam(required = false) AuditAction action,
            @RequestParam(required = false) Long actorId,
            @PageableDefault(size = 30, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return auditLogService.listForGuild(guildId, action, actorId, pageable).map(GuildAuditEntryDto::from);
    }
}
