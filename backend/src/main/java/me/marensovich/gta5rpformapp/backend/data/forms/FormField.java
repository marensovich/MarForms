package me.marensovich.gta5rpformapp.backend.data.forms;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Represents a single field within a form.
 * <p>
 * Contains all configuration properties for a form field including its type,
 * display label, validation rules, and available options.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Data
@NoArgsConstructor
public class FormField {

    /**
     * Unique identifier for the field within the form.
     *
     * @since v.0.1
     */
    private String id;

    /**
     * The data type of the field.
     * Determines how the field is rendered and validated.
     *
     * @see FieldType
     * @since v.0.1
     */
    private FieldType type;

    /**
     * Display label for the field shown to the user.
     *
     * @since v.0.1
     */
    private String label;

    /**
     * Indicates whether the field is mandatory for submission.
     *
     * @since v.0.1
     */
    private boolean required;

    /**
     * Available options for selection-based field types.
     * <p>
     * Used by types: {@code SELECT}, {@code MULTI_SELECT}, {@code RADIO}, {@code CHECKBOX}.
     * </p>
     *
     * @since v.0.1
     */
    private List<String> options;

    /**
     * Maximum value or maximum length for numeric/text fields.
     * <p>
     * Used by types: {@code NUMBER}, {@code TEXT}, {@code TEXTAREA}.
     * </p>
     *
     * @since v.0.1
     */
    private Integer max;

    /**
     * Minimum value or minimum length for numeric/text fields.
     * <p>
     * Used by types: {@code NUMBER}, {@code TEXT}, {@code TEXTAREA}.
     * </p>
     *
     * @since v.0.1
     */
    private Integer min;

    /**
     * Placeholder text shown inside empty inputs.
     *
     * @since v.0.1
     */
    private String placeholder;

    /**
     * Help text shown under the label (or the body text of a
     * {@code SECTION_BREAK}).
     *
     * @since v.0.1
     */
    private String description;

    /**
     * Show this field only when another field's answer matches (E3.1);
     * {@code null} means always shown. A hidden field is never required
     * and its answer is not stored.
     *
     * @since v.0.1
     */
    private FieldCondition condition;

    /**
     * {@code FILE_UPLOAD} only: allowed extensions without the dot
     * ({@code ["pdf", "png"]}); empty means {@code FileRules.DEFAULT_EXTENSIONS}.
     *
     * @since v.0.1
     */
    private List<String> allowedExtensions;

    /**
     * {@code FILE_UPLOAD} only: size limit in MB, up to
     * {@code FileRules.MAX_SIZE_MB}; {@code null} means {@code FileRules.DEFAULT_SIZE_MB}.
     *
     * @since v.0.1
     */
    private Integer maxFileSizeMb;

    /**
     * {@code TEXT}/{@code TEXTAREA}: answer length bounds (ТЗ 3.4), apart from
     * {@link #min}/{@link #max}, which bound a {@code NUMBER}'s value. Older
     * forms kept a text's length in {@code min}/{@code max}; it is still read there.
     *
     * @since v.0.1
     */
    private Integer minLength;

    /** See {@link #minLength}. */
    private Integer maxLength;

    /** {@code MULTI_SELECT}/{@code CHECKBOX} with options: how many may be chosen (ТЗ 3.4). */
    private Integer minSelected;

    /** See {@link #minSelected}. */
    private Integer maxSelected;

    /**
     * {@code DATE}/{@code TIME}/{@code DATETIME}: the allowed range, inclusive, in
     * the answer's own format ({@code 2026-10-01}, {@code 08:00}, {@code 2026-10-01T08:00}).
     */
    private String minDate;

    /** See {@link #minDate}. */
    private String maxDate;

    /** {@code FILE_UPLOAD}: how many files, 1–{@code FileRules.MAX_FILES}; {@code null} = {@code FileRules.DEFAULT_MAX_FILES}. */
    private Integer maxFiles;

    /**
     * Enumeration of all supported field input types.
     * <p>
     * Each type corresponds to a specific input control and validation strategy.
     * </p>
     *
     * @author marensovich
     * @since v.0.1
     */
    public enum FieldType {
        /**
         * Single-line text input
         */
        TEXT,
        /**
         * Multi-line text input
         */
        TEXTAREA,
        /**
         * Numeric input with optional min/max constraints
         */
        NUMBER,
        /**
         * Email address input with validation
         */
        EMAIL,
        /**
         * Password input (masked characters)
         */
        PASSWORD,
        /**
         * URL input with validation
         */
        URL,
        /**
         * Phone number input
         */
        PHONE,
        /**
         * Single-select dropdown
         */
        SELECT,
        /**
         * Multi-select dropdown
         */
        MULTI_SELECT,
        /**
         * Radio button group (single choice)
         */
        RADIO,
        /**
         * Checkbox group (multiple choices)
         */
        CHECKBOX,
        /**
         * Single checkbox (true/false)
         */
        BOOLEAN,
        /**
         * Date picker input
         */
        DATE,
        /**
         * Time picker input
         */
        TIME,
        /**
         * Combined date and time picker
         */
        DATETIME,
        /**
         * Star/scale rating from 1 to {@code max} (default 5, at most 10)
         */
        RATING,
        /**
         * Not an input: a heading ({@code label}) and optional text
         * ({@code description}) that splits a long form into sections.
         * Never required, never has an answer.
         */
        SECTION_BREAK,
        /** A file attachment (E3.2); the answer is the uploaded file's ID. */
        FILE_UPLOAD;

        /**
         * Whether a respondent answers this field at all.
         *
         * @return {@code false} only for {@link #SECTION_BREAK}
         */
        public boolean isInput() {
            return this != SECTION_BREAK;
        }
    }
}