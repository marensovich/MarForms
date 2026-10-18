package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.dto.submission.SubmissionDto;
import me.marensovich.gta5rpformapp.backend.service.SubmissionService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The platform's «Заявки» (ТЗ 6.2): every submission on every form, filtered
 * by form, dates and user and paged on the server, its KPIs, and the same
 * submissions grouped by user.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/admin/submissions")
@RequiredArgsConstructor
public class AdminSubmissionController {

    private final SubmissionService submissionService;
    private final SubmissionRepository submissionRepository;
    private final FormRepository formRepository;
    private final GuildRepository guildRepository;
    private final UserRepository userRepository;

    /**
     * A row of «Все заявки»: the submission (with its author's name and the
     * form's title), the form's server, and how many of its fields were filled.
     */
    public record AdminSubmissionRow(SubmissionDto submission,
                                     @JsonSerialize(using = ToStringSerializer.class) Long guildId,
                                     String guildName, String avatarUrl, int answered, int fields) {
    }

    /** The KPIs of ТЗ 6.2. */
    public record Stats(long total, long lastWeek, long forms, long activeForms, long users) {
    }

    /** A row of «По пользователям». */
    public record UserRow(@JsonSerialize(using = ToStringSerializer.class) Long discordId, String username,
                          String avatarUrl, long submissions, long forms, LocalDateTime last) {
    }

    /**
     * All submissions, newest first unless asked otherwise.
     *
     * @param formId one form, or all
     * @param from   the first day, inclusive
     * @param to     the last day, inclusive
     * @param user   the author: a Discord ID or part of a username
     * @param sort   {@code createdAt,desc} or {@code createdAt,asc}
     * @param page   0-based
     * @param size   at most 100
     * @return the page
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('RESPONSES_MANAGE')")
    @GetMapping
    public Page<AdminSubmissionRow> list(@RequestParam(required = false) UUID formId,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                         @RequestParam(required = false) String user,
                                         @RequestParam(defaultValue = "createdAt,desc") String sort,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "25") int size) {
        Set<Long> authors = authors(user);
        PageRequest request = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                sort.endsWith(",asc") ? Sort.by("createdAt").ascending() : Sort.by("createdAt").descending());
        if (authors != null && authors.isEmpty()) return Page.empty(request);

        Page<Submission> submissions = submissionRepository.findAll(filter(formId, from, to, authors), request);
        Map<UUID, Form> forms = formRepository.findAllById(submissions.stream().map(Submission::getFormId)
                .collect(Collectors.toSet())).stream().collect(Collectors.toMap(Form::getId, Function.identity()));
        Map<Long, Guild> guilds = guildRepository.findAllById(forms.values().stream().map(Form::getServerId)
                .filter(Objects::nonNull).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(Guild::getDiscordGuildId, Function.identity()));
        Map<Long, User> users = usersById(submissions.stream().map(Submission::getDiscordId)
                .filter(Objects::nonNull).collect(Collectors.toSet()));
        return submissions.map(s -> {
            Form form = forms.get(s.getFormId());
            Guild guild = form != null && form.getServerId() != null ? guilds.get(form.getServerId()) : null;
            User author = s.getDiscordId() != null ? users.get(s.getDiscordId()) : null;
            FormSchema questions = s.getSchemaSnapshot() != null ? s.getSchemaSnapshot() : form != null ? form.getSchema() : null;
            List<FormField> inputs = questions == null || questions.getFields() == null ? List.of()
                    : questions.getFields().stream().filter(f -> f.getType() != FormField.FieldType.SECTION_BREAK).toList();
            int answered = (int) inputs.stream().filter(f -> filled(s.getAnswers().get(f.getId()))).count();
            return new AdminSubmissionRow(
                    SubmissionDto.from(s, author != null ? author.getDiscordUsername() : null, form != null ? form.getTitle() : null),
                    guild != null ? guild.getDiscordGuildId() : null, guild != null ? guild.getName() : null,
                    avatarUrl(author), answered, inputs.size());
        });
    }

    /** All submissions and those of the last 7 days, forms (and active ones), unique users. */
    @PreAuthorize("hasAuthority('RESPONSES_MANAGE')")
    @GetMapping("/stats")
    public Stats stats() {
        return new Stats(submissionRepository.count(),
                submissionRepository.count((root, q, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), LocalDateTime.now().minusDays(7))),
                formRepository.count(),
                formRepository.count((root, q, cb) -> cb.equal(root.get("status"), FormStatus.PUBLISHED)),
                submissionRepository.countAuthors());
    }

    /**
     * Users with at least one submission, the most active first: how many
     * submissions, on how many forms, and the latest one.
     *
     * @param user a Discord ID or part of a username, or all
     * @param page 0-based
     * @param size at most 100
     * @return the page
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('RESPONSES_MANAGE')")
    @GetMapping("/by-user")
    public Page<UserRow> byUser(@RequestParam(required = false) String user,
                                @RequestParam(defaultValue = "0") int page,
                                @RequestParam(defaultValue = "25") int size) {
        Set<Long> authors = authors(user);
        PageRequest request = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        if (authors != null && authors.isEmpty()) return Page.empty(request);
        Page<Object[]> rows = authors == null ? submissionRepository.countByAuthor(request)
                : submissionRepository.countByAuthor(authors, request);
        Map<Long, User> users = usersById(rows.stream().map(r -> (Long) r[0]).collect(Collectors.toSet()));
        return rows.map(r -> {
            User u = users.get((Long) r[0]);
            return new UserRow((Long) r[0], u != null ? u.getDiscordUsername() : null, avatarUrl(u),
                    ((Number) r[1]).longValue(), ((Number) r[2]).longValue(), (LocalDateTime) r[3]);
        });
    }

    /**
     * Deletes a submission by its ID.
     * <p>
     * Permanently removes the specified submission from the system.
     * </p>
     * <p>
     * Requires the {@code RESPONSES_MANAGE} authority.
     * </p>
     *
     * @param id the UUID of the submission to delete
     * @return a {@link ResponseEntity} with status 204 (No Content)
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('RESPONSES_MANAGE') or @guildAccess.hasRoleForSubmission(#id, 'MODERATOR')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        submissionService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** The authors a filter means: a Discord ID and the usernames containing it; {@code null} for no filter. */
    private Set<Long> authors(String user) {
        if (user == null || user.isBlank()) return null;
        String q = user.trim();
        Set<Long> ids = userRepository.findAllByDiscordUsernameContainingIgnoreCase(q).stream()
                .map(User::getDiscordId).collect(Collectors.toCollection(HashSet::new));
        if (q.matches("\\d{1,19}")) ids.add(Long.parseLong(q));
        return ids;
    }

    private Map<Long, User> usersById(Set<Long> ids) {
        if (ids.isEmpty()) return Map.of();
        return userRepository.findAllByDiscordIdIn(ids).stream()
                .collect(Collectors.toMap(User::getDiscordId, Function.identity(), (a, b) -> a));
    }

    private static Specification<Submission> filter(UUID formId, LocalDate from, LocalDate to, Set<Long> authors) {
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (formId != null) p.add(cb.equal(root.get("formId"), formId));
            if (from != null) p.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from.atStartOfDay()));
            if (to != null) p.add(cb.lessThan(root.get("createdAt"), to.plusDays(1).atStartOfDay()));
            if (authors != null) p.add(root.get("discordId").in(authors));
            return cb.and(p.toArray(Predicate[]::new));
        };
    }

    private static boolean filled(Object answer) {
        if (answer == null) return false;
        if (answer instanceof String s) return !s.isBlank();
        if (answer instanceof Collection<?> c) return !c.isEmpty();
        return true;
    }

    private static String avatarUrl(User user) {
        return user == null || user.getDiscordAvatar() == null ? null
                : "https://cdn.discordapp.com/avatars/" + user.getDiscordId() + "/" + user.getDiscordAvatar() + ".png?size=64";
    }
}
