package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.database.entity.AuditLog;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.dto.audit.AuditLogDto;
import me.marensovich.gta5rpformapp.backend.service.AuditLogService;
import me.marensovich.gta5rpformapp.backend.service.AuditLogStream;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDate;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The platform journal (ТЗ 6.5): every action of users and staff, kept 365
 * days — filtered, with its KPIs, the diff of each change, and «Live».
 * Requires the {@code SYSTEM_ADMIN} authority.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/admin/logs")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('SYSTEM_ADMIN')")
public class AuditLogController {

    private final AuditLogService auditLogService;
    private final AuditLogStream auditLogStream;
    private final UserRepository userRepository;

    /**
     * The journal, newest first.
     *
     * @param actions     the actions to show, any if none
     * @param participant a Discord ID: who acted or who was acted on
     * @param from        the first day
     * @param to          the last day
     * @param page        0-based
     * @param size        at most 100
     * @return the page
     * @since v.0.1
     */
    @GetMapping
    public Page<AuditLogDto> list(@RequestParam(required = false) Set<AuditAction> actions,
                                  @RequestParam(required = false) Long participant,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                  @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "25") int size) {
        PageRequest request = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        Page<AuditLog> entries = auditLogService.search(actions, participant, from, to, request);
        Map<Long, String> avatars = userRepository.findAllByDiscordIdIn(entries.stream().map(AuditLog::getActorDiscordId)
                        .filter(Objects::nonNull).collect(Collectors.toSet())).stream()
                .filter(u -> u.getDiscordAvatar() != null)
                .collect(Collectors.toMap(User::getDiscordId, AuditLogDto::avatarUrl, (a, b) -> a));
        return entries.map(e -> AuditLogDto.from(e, e.getActorDiscordId() == null ? null : avatars.get(e.getActorDiscordId())));
    }

    /** All entries, and today's entries, decisions, bans and time-outs, rights changes (ТЗ 6.5 KPI). */
    @GetMapping("/stats")
    public Map<String, Long> stats() {
        return auditLogService.stats();
    }

    /** «Live»: new entries as server-sent events named {@code entry}. */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return auditLogStream.subscribe();
    }
}
