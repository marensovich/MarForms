package me.marensovich.gta5rpformapp.backend.dto.submission;

import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionEventType;
import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.SubmissionEvent;
import org.springframework.lang.Nullable;

import java.time.LocalDateTime;

/**
 * A step of a submission's history, as the card shows it (#118).
 *
 * @param type      what happened
 * @param from      the status before, null for the submission itself
 * @param to        the status after
 * @param actorName who did it, null if unknown or anonymous
 * @param comment   the comment given, if any
 * @param at        when
 * @author marensovich
 * @since v.0.1
 */
public record SubmissionEventDto(
        SubmissionEventType type,
        SubmissionStatus from,
        SubmissionStatus to,
        String actorName,
        String comment,
        LocalDateTime at
) {
    public static SubmissionEventDto from(SubmissionEvent event, @Nullable String actorName) {
        return new SubmissionEventDto(event.getType(), event.getFromStatus(), event.getToStatus(), actorName,
                event.getComment(), event.getCreatedAt());
    }
}
