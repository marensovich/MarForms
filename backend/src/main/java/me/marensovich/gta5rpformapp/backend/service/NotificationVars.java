package me.marensovich.gta5rpformapp.backend.service;

import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * The variables of a notification's texts (ТЗ 6.7, #148): {@code {user.mention}},
 * {@code {user.name}}, {@code {user.id}}, {@code {form.title}}, {@code {form.url}},
 * {@code {server.name}}, {@code {status}}, {@code {date}} — and the older
 * underscore names ({@code {user_mention}}, {@code {form_title}}, …) that saved
 * webhooks may still use. An anonymous submission gives nothing of its author.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public final class NotificationVars {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm:ss");
    private static final String ANONYMOUS = "Аноним";

    private Long userId;
    private String userName;
    private boolean anonymous;
    private String formTitle = "";
    private String formUrl = "";
    private UUID formId;
    private Long serverId;
    private String serverName = "";
    private String status = "";
    private UUID submissionId;

    public static NotificationVars of() {
        return new NotificationVars();
    }

    /** The author; {@code anonymous} hides them whatever is known. */
    public NotificationVars user(Long id, String name, boolean anonymous) {
        this.userId = id;
        this.userName = name;
        this.anonymous = anonymous;
        return this;
    }

    public NotificationVars form(UUID id, String title, String url) {
        this.formId = id;
        this.formTitle = title == null ? "" : title;
        this.formUrl = url == null ? "" : url;
        return this;
    }

    public NotificationVars server(Long id, String name) {
        this.serverId = id;
        this.serverName = name == null ? "" : name;
        return this;
    }

    public NotificationVars status(SubmissionStatus status) {
        this.status = status == null ? "" : label(status);
        return this;
    }

    public NotificationVars submission(UUID id) {
        this.submissionId = id;
        return this;
    }

    /** A submission status as the texts say it. */
    public static String label(SubmissionStatus status) {
        return switch (status) {
            case PENDING -> "На рассмотрении";
            case APPROVED -> "Принята";
            case REJECTED -> "Отклонена";
            case NEEDS_REVISION -> "Нужна доработка";
        };
    }

    /**
     * The variables, both spellings.
     *
     * @return name → value
     * @since v.0.1
     */
    public Map<String, String> build() {
        LocalDateTime now = LocalDateTime.now();
        boolean known = !anonymous && userId != null;
        String mention = known ? "<@" + userId + ">" : anonymous ? ANONYMOUS : "Unknown";
        String name = anonymous ? ANONYMOUS : userName != null ? userName : known ? userId.toString() : "Unknown";
        String id = known ? userId.toString() : "";

        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("user.mention", mention);
        vars.put("user.name", name);
        vars.put("user.id", id);
        vars.put("form.title", formTitle);
        vars.put("form.url", formUrl);
        vars.put("server.name", serverName);
        vars.put("status", status);
        vars.put("date", now.format(DATE));
        // The names saved webhooks were written with.
        vars.put("user_mention", mention);
        vars.put("username", name);
        vars.put("user_id", known ? id : anonymous ? "" : "unknown");
        vars.put("form_title", formTitle);
        vars.put("form_id", formId != null ? formId.toString() : "");
        vars.put("submission_id", submissionId != null ? submissionId.toString() : "");
        vars.put("server_id", serverId != null ? serverId.toString() : "");
        vars.put("timestamp", "<t:" + now.atZone(ZoneId.systemDefault()).toEpochSecond() + ":f>");
        vars.put("time", now.format(TIME));
        return vars;
    }
}
