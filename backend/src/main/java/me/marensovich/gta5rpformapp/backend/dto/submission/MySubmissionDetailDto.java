package me.marensovich.gta5rpformapp.backend.dto.submission;

import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;

import java.util.List;
import java.util.Map;

/**
 * One of the respondent's own submissions with its answers, for the side panel
 * of «Мои заявки» (ТЗ ФТ-3.6.4).
 *
 * @param submission the row as listed
 * @param schema     the questions it answered (its snapshot, #117)
 * @param answers    the answers by field ID
 * @param files      the files it carries
 * @author marensovich
 * @since v.0.1
 */
public record MySubmissionDetailDto(
        MySubmissionDto submission,
        FormSchema schema,
        Map<String, Object> answers,
        List<SubmissionFileDto> files
) {
}
