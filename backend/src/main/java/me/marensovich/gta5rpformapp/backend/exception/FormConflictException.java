package me.marensovich.gta5rpformapp.backend.exception;

import lombok.Getter;
import org.springframework.lang.Nullable;

import java.time.LocalDateTime;

/**
 * A save based on an outdated version of a form (ТЗ 5.7): someone else saved
 * it since — the editor names them.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Getter
public class FormConflictException extends RuntimeException {

    @Nullable
    private final String updatedBy;
    @Nullable
    private final LocalDateTime updatedAt;

    public FormConflictException(@Nullable String updatedBy, @Nullable LocalDateTime updatedAt) {
        super("This form was changed elsewhere — reload it to see the latest version");
        this.updatedBy = updatedBy;
        this.updatedAt = updatedAt;
    }
}
