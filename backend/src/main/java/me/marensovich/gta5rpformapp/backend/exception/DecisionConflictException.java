package me.marensovich.gta5rpformapp.backend.exception;

import lombok.Getter;
import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;
import org.springframework.lang.Nullable;

import java.time.LocalDateTime;

/**
 * A decision on a submission that is no longer pending (ТЗ ФТ-4.5.6): answered
 * with 409 and who decided and when, so the second moderator sees it.
 *
 * @author marensovich
 * @since v.0.1
 */
@Getter
public class DecisionConflictException extends RuntimeException {

    private final SubmissionStatus status;
    @Nullable
    private final String decidedBy;
    @Nullable
    private final LocalDateTime decidedAt;

    public DecisionConflictException(SubmissionStatus status, @Nullable String decidedBy, @Nullable LocalDateTime decidedAt) {
        super("This submission has already been decided (" + status + ")");
        this.status = status;
        this.decidedBy = decidedBy;
        this.decidedAt = decidedAt;
    }
}
