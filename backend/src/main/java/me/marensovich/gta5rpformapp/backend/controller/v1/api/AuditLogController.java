package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.dto.audit.AuditLogDto;
import me.marensovich.gta5rpformapp.backend.service.AuditLogService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for accessing audit log entries.
 * Requires {@code SYSTEM_ADMIN} authority.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/admin/logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogService auditLogService;

    /**
     * Returns a paginated list of audit log entries with optional filters.
     *
     * @param action         optional action type filter
     * @param actorDiscordId optional actor Discord ID filter
     * @param page           page number (default 0)
     * @param size           page size (default 25)
     * @return page of {@link AuditLogDto}
     */
    @PreAuthorize("hasAuthority('SYSTEM_ADMIN')")
    @GetMapping
    public Page<AuditLogDto> listAll(
            @RequestParam(required = false) AuditAction action,
            @RequestParam(required = false) Long actorDiscordId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size
    ) {
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");
        return auditLogService.listAll(action, actorDiscordId, PageRequest.of(page, size, sort))
                .map(AuditLogDto::from);
    }
}
