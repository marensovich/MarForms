package me.marensovich.gta5rpformapp.backend.dto.submission;

import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import org.springframework.lang.Nullable;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A respondent's own submission, as listed by {@code GET /api/v1/me/submissions}
 * (ТЗ 3.6): the form and its server, the status, and the moderator's comment with
 * their name — the mockup shows who decided (open question 9.3 answered by it).
 *
 * @param id               the submission's ID
 * @param number           its short number on the server ("№ 1048"), null for an unknown server
 * @param formId           the form it was submitted to
 * @param formTitle        that form's title, null if the form is gone
 * @param formSlug         the form's public address, for «Доработать и отправить»
 * @param guildId          the form's server
 * @param guildName        that server's name, null if the platform doesn't know it
 * @param guildIconUrl     that server's icon, null without one
 * @param status           moderation status
 * @param moderatorComment the moderator's comment, if any
 * @param moderatorName    who decided, if anyone has
 * @param createdAt        when it was submitted
 * @param decidedAt        when it was decided, if it was
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record MySubmissionDto(
        UUID id,
        Long number,
        UUID formId,
        String formTitle,
        String formSlug,
        String guildId,
        String guildName,
        String guildIconUrl,
        SubmissionStatus status,
        String moderatorComment,
        String moderatorName,
        LocalDateTime createdAt,
        LocalDateTime decidedAt
) {
    public static MySubmissionDto from(Submission submission, @Nullable Form form, @Nullable Guild guild,
                                       @Nullable String moderatorName) {
        return new MySubmissionDto(submission.getId(), submission.getNumber(), submission.getFormId(),
                form != null && form.getSchema() != null ? form.getSchema().getTitle() : null,
                form != null ? form.getSlug() : null,
                form != null && form.getServerId() != null ? String.valueOf(form.getServerId()) : null,
                guild != null ? guild.getName() : null,
                guild != null ? guild.iconUrl() : null,
                submission.getStatus(), submission.getModeratorComment(), moderatorName,
                submission.getCreatedAt(), submission.getDecidedAt());
    }
}
