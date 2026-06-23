package me.marensovich.gta5rpformapp.backend.dto.form;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

/**
 * Data Transfer Object representing a full form response.
 * <p>
 * Contains all form details including the complete schema, metadata,
 * and configuration. Used for retrieving and displaying forms.
 * </p>
 *
 * @param id          the unique identifier of the form
 * @param serverId    the Discord server (guild) ID the form belongs to
 * @param channelsIds the set of Discord channel IDs where the form can be submitted
 * @param schema      the JSON schema defining the form structure
 * @param active      indicates whether the form is active and accepting submissions
 * @param createdAt   the timestamp when the form was created
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record FormResponseDto(
        UUID id,
        @JsonSerialize(using = ToStringSerializer.class)
        Long serverId,
        @JsonSerialize(using = ToStringSerializer.class)
        Set<Long> channelsIds,
        FormSchema schema,
        boolean active,
        LocalDateTime createdAt
) {
    /**
     * Converts a {@link Form} entity to a {@link FormResponseDto}.
     *
     * @param form the form entity to convert
     * @return a new {@link FormResponseDto} containing the form data
     * @since v.0.1
     */
    public static FormResponseDto from(Form form) {
        return new FormResponseDto(
                form.getId(),
                form.getServerId(),
                form.getChannelsIds(),
                form.getSchema(),
                form.isActive(),
                form.getCreatedAt()
        );
    }
}