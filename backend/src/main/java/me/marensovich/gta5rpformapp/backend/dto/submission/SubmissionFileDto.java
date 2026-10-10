package me.marensovich.gta5rpformapp.backend.dto.submission;

import me.marensovich.gta5rpformapp.backend.database.entity.SubmissionFile;

import java.util.UUID;

/**
 * An uploaded file (E3.2): returned by the upload endpoint, and listed on
 * the moderation card. Its {@code id} is the {@code FILE_UPLOAD} answer.
 *
 * @param id          the file's ID
 * @param fieldId     the field it was uploaded for
 * @param name        the original file name
 * @param contentType the type the browser reported, if any
 * @param size        size in bytes
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record SubmissionFileDto(UUID id, String fieldId, String name, String contentType, long size) {

    public static SubmissionFileDto from(SubmissionFile file) {
        return new SubmissionFileDto(file.getId(), file.getFieldId(), file.getOriginalName(), file.getContentType(),
                file.getSizeBytes());
    }
}
