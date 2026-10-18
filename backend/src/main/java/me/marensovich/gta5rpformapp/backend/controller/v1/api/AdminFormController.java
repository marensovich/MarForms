package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildBotStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.dto.form.FormSummaryDto;
import me.marensovich.gta5rpformapp.backend.service.FormService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

/**
 * The platform's «Формы» (ТЗ 6.1): every form on every connected server,
 * filtered, sorted and paged on the server (8.6: hundreds of thousands of
 * rows), with its KPIs, bulk deactivate/delete, a CSV of the list and the
 * connected servers.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/admin/forms")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('FORMS_MANAGE')")
public class AdminFormController {

    private static final int CSV_LIMIT = 50_000;

    private final FormRepository formRepository;
    private final SubmissionRepository submissionRepository;
    private final GuildRepository guildRepository;
    private final FormService formService;

    /** A form row: the summary plus its server's name. */
    public record AdminFormRow(FormSummaryDto form, String guildName, String guildIconUrl) {
    }

    /** The KPIs of ТЗ 6.1. */
    public record Stats(long total, long active, long submissions) {
    }

    /** A connected server for the side panel: its bot's state and how many forms it has. */
    public record ServerRow(@JsonSerialize(using = ToStringSerializer.class) Long guildId, String name, String iconUrl,
                            GuildBotStatus botStatus, long forms) {
    }

    public record BulkRequest(@NotEmpty @Size(max = 500) List<UUID> ids, @NotEmpty String action) {
    }

    /**
     * The forms list.
     *
     * @param status   {@code all}, {@code active} (published) or {@code inactive} (the rest)
     * @param serverId one server, or all
     * @param q        part of the title or the slug
     * @param sort     {@code createdAt}, {@code title}, {@code status} or {@code submissions}, then {@code ,asc|,desc}
     * @param page     0-based
     * @param size     at most 100
     * @return the page
     * @since v.0.1
     */
    @GetMapping
    public Page<AdminFormRow> list(@RequestParam(defaultValue = "all") String status,
                                   @RequestParam(required = false) Long serverId,
                                   @RequestParam(required = false) String q,
                                   @RequestParam(defaultValue = "createdAt,desc") String sort,
                                   @RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "25") int size) {
        String[] parts = sort.split(",");
        String key = parts[0];
        boolean asc = parts.length > 1 && parts[1].equalsIgnoreCase("asc");
        Specification<Form> spec = filter(status, serverId, q);
        PageRequest request;
        if (key.equals("submissions")) {
            // Ordered by how many submissions a form has: a subquery, never a count per row in memory.
            spec = spec.and((root, query, cb) -> {
                if (query.getResultType() != Long.class && query.getResultType() != long.class) {
                    Subquery<Long> count = query.subquery(Long.class);
                    var s = count.from(Submission.class);
                    count.select(cb.count(s)).where(cb.equal(s.get("formId"), root.get("id")));
                    query.orderBy(asc ? cb.asc(count) : cb.desc(count));
                }
                return null;
            });
            request = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        } else {
            String property = switch (key) {
                case "title", "status" -> key;
                default -> "createdAt";
            };
            request = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                    asc ? Sort.by(property).ascending() : Sort.by(property).descending());
        }
        Page<Form> forms = formRepository.findAll(spec, request);
        Map<Long, Guild> guilds = guildRepository.findAllById(forms.stream().map(Form::getServerId)
                .filter(Objects::nonNull).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(Guild::getDiscordGuildId, g -> g));
        return forms.map(f -> {
            Guild g = guilds.get(f.getServerId());
            return new AdminFormRow(FormSummaryDto.from(f, submissionRepository.countByFormId(f.getId())),
                    g != null ? g.getName() : null, g != null ? g.iconUrl() : null);
        });
    }

    /** All forms, active ones and all submissions — for the KPI row. */
    @GetMapping("/stats")
    public Stats stats() {
        return new Stats(formRepository.count(), formRepository.count((root, q, cb) -> cb.equal(root.get("status"), FormStatus.PUBLISHED)),
                submissionRepository.count());
    }

    /** Connected servers with their bot's state and their number of forms. */
    @GetMapping("/servers")
    public List<ServerRow> servers() {
        return guildRepository.findAll(Sort.by("name")).stream()
                .map(g -> new ServerRow(g.getDiscordGuildId(), g.getName(), g.iconUrl(), g.getBotStatus(),
                        formRepository.countByServerIdAndStatusNot(g.getDiscordGuildId(), FormStatus.ARCHIVED)))
                .toList();
    }

    /**
     * «Деактивировать» (closes published forms; their data stays) or «Удалить»
     * (the forms and all their submissions, each logged with how many) for the
     * chosen rows (ТЗ 6.1).
     *
     * @param request the forms and {@code DEACTIVATE} or {@code DELETE}
     * @return how many were changed
     * @since v.0.1
     */
    @PostMapping("/bulk")
    public Map<String, Integer> bulk(@RequestBody @jakarta.validation.Valid BulkRequest request) {
        int done = 0;
        for (UUID id : new LinkedHashSet<>(request.ids())) {
            Form form = formRepository.findById(id).orElse(null);
            if (form == null) continue;
            switch (request.action()) {
                case "DEACTIVATE" -> {
                    if (form.getStatus() != FormStatus.PUBLISHED) continue;
                    formService.changeStatus(id, FormStatus.CLOSED);
                }
                case "DELETE" -> formService.delete(id);
                default -> throw new IllegalArgumentException("Unknown action: " + request.action());
            }
            done++;
        }
        return Map.of("done", done);
    }

    /** The list as filtered, as CSV (ТЗ 6.1 «Экспорт CSV»), up to 50 000 rows. */
    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<byte[]> export(@RequestParam(defaultValue = "all") String status,
                                         @RequestParam(required = false) Long serverId,
                                         @RequestParam(required = false) String q) {
        Page<Form> forms = formRepository.findAll(filter(status, serverId, q),
                PageRequest.of(0, CSV_LIMIT, Sort.by("createdAt").descending()));
        Map<Long, String> names = guildRepository.findAll().stream()
                .collect(Collectors.toMap(Guild::getDiscordGuildId, Guild::getName, (a, b) -> a));
        StringBuilder csv = new StringBuilder("﻿id,title,slug,server,status,submissions,created\n");
        for (Form f : forms) {
            csv.append(f.getId()).append(',').append(cell(f.getTitle())).append(',').append(cell(f.getSlug())).append(',')
                    .append(cell(names.get(f.getServerId()))).append(',').append(f.getStatus()).append(',')
                    .append(submissionRepository.countByFormId(f.getId())).append(',').append(f.getCreatedAt()).append('\n');
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"forms.csv\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static Specification<Form> filter(String status, Long serverId, String q) {
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if ("active".equals(status)) p.add(cb.equal(root.get("status"), FormStatus.PUBLISHED));
            if ("inactive".equals(status)) p.add(cb.notEqual(root.get("status"), FormStatus.PUBLISHED));
            if (serverId != null) p.add(cb.equal(root.get("serverId"), serverId));
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase(Locale.ROOT).replace("%", "\\%").replace("_", "\\_") + "%";
                p.add(cb.or(cb.like(cb.lower(root.get("title")), like, '\\'), cb.like(cb.lower(root.get("slug")), like, '\\')));
            }
            return cb.and(p.toArray(Predicate[]::new));
        };
    }

    /** A CSV cell: quoted when needed; a leading =, +, -, @ is defused (formula injection). */
    private static String cell(String value) {
        if (value == null) return "";
        String v = value;
        if (!v.isEmpty() && "=+-@".indexOf(v.charAt(0)) >= 0) v = "'" + v;
        return v.contains(",") || v.contains("\"") || v.contains("\n") ? "\"" + v.replace("\"", "\"\"") + "\"" : v;
    }
}
