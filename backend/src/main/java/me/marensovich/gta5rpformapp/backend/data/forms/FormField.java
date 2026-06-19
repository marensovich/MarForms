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
     * Enumeration of all supported field input types.
     * <p>
     * Each type corresponds to a specific input control and validation strategy.
     * </p>
     *
     * @author marensovich
     * @since v.0.1
     */
    public enum FieldType {
        /** Single-line text input */
        TEXT,
        /** Multi-line text input */
        TEXTAREA,
        /** Numeric input with optional min/max constraints */
        NUMBER,
        /** Email address input with validation */
        EMAIL,
        /** Password input (masked characters) */
        PASSWORD,
        /** URL input with validation */
        URL,
        /** Phone number input */
        PHONE,
        /** Single-select dropdown */
        SELECT,
        /** Multi-select dropdown */
        MULTI_SELECT,
        /** Radio button group (single choice) */
        RADIO,
        /** Checkbox group (multiple choices) */
        CHECKBOX,
        /** Single checkbox (true/false) */
        BOOLEAN,
        /** Date picker input */
        DATE,
        /** Time picker input */
        TIME,
        /** Combined date and time picker */
        DATETIME
    }
}