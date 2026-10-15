package me.marensovich.gta5rpformapp.backend.data.forms;

import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Represents the schema definition of a form.
 * <p>
 * Contains the structural definition of a form including its title, description,
 * and fields organized in rows. The schema is used for rendering the form
 * on the frontend and for validating submissions.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Data
@NoArgsConstructor
public class FormSchema {

    /**
     * The display title of the form.
     *
     * @since v.0.1
     */
    private String title;

    /**
     * A brief description of the form's purpose or instructions for filling it out.
     *
     * @since v.0.1
     */
    private String description;

    /**
     * How long a review usually takes, in the author's words ("обычно в течение 1–2 дней"),
     * shown on the respondent's success page (#114); {@code null} if not set.
     */
    @Size(max = 120)
    private String reviewTime;

    /**
     * A list of field rows, where each row contains a list of {@link FormField} objects.
     * <p>
     * Fields within the same row are rendered side by side on the same line.
     * Each nested list represents a separate row in the form layout.
     * </p>
     *
     * @since v.0.1
     */
    private List<FormField> fields = new ArrayList<>();
}