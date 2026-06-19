package me.marensovich.gta5rpformapp.backend.dto.form;

import me.marensovich.gta5rpformapp.backend.database.entity.Form;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Data Transfer Object representing a summarized view of a form.
 * <p>
 * Contains basic form information and statistics, used for dashboard
 * listings and overview displays.
 * </p>
 *
 * @param id              the unique identifier of the form
 * @param title           the title of the form (extracted from the schema)
 * @param active          indicates whether the form is active and accepting submissions
 * @param submissionCount the total number of submissions received for this form
 * @param createdAt       the timestamp when the form was created
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record FormSummaryDto(
        UUID id,
        String title,
        boolean active,
        long submissionCount,
        LocalDateTime createdAt
) {
    /**
     * Converts a {@link Form} entity and its submission count to a {@link FormSummaryDto}.
     *
     * @param form            the form entity to convert
     * @param submissionCount the total number of submissions for the form
     * @return a new {@link FormSummaryDto} containing the summarized form data
     * @since v.0.1
     */
    public static FormSummaryDto from(Form form, long submissionCount) {
        return new FormSummaryDto(
                form.getId(),
                form.getSchema() != null ? form.getSchema().getTitle() : null,
                form.isActive(),
                submissionCount,
                form.getCreatedAt()
        );
    }
}