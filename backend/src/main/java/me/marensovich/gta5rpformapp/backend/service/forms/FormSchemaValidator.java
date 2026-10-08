package me.marensovich.gta5rpformapp.backend.service.forms;

import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField.FieldType;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.exception.FieldValidationException;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Validates a form's structure (task #42): every field's configuration must
 * make sense for its type. Shared by every path that writes a schema —
 * whole-form create/update and the per-field API — so the rules can't
 * drift apart.
 * <p>
 * Rules:
 * <ul>
 *     <li>the form has a title; every field has a non-blank, unique {@code id}, a type and a label;</li>
 *     <li>{@code SELECT}, {@code MULTI_SELECT}, {@code RADIO} need at least 2 distinct non-blank options;</li>
 *     <li>{@code RATING}'s {@code max} (scale size) is 2–10;</li>
 *     <li>{@code min} ≤ {@code max} whenever both are set, and neither is negative for text lengths;</li>
 *     <li>a {@code SECTION_BREAK} can't be required.</li>
 * </ul>
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public final class FormSchemaValidator {

    static final int RATING_MAX_SCALE = 10;
    private static final Set<FieldType> CHOICE_TYPES = Set.of(FieldType.SELECT, FieldType.MULTI_SELECT, FieldType.RADIO);
    private static final Set<FieldType> LENGTH_TYPES = Set.of(FieldType.TEXT, FieldType.TEXTAREA);

    private FormSchemaValidator() {
    }

    /**
     * Validates a whole schema.
     *
     * @param schema the schema to check
     * @throws FieldValidationException listing every problem found, keyed by path
     *                                  (e.g. {@code fields[1].options})
     * @since v.0.1
     */
    public static void validate(FormSchema schema) {
        Map<String, String> errors = new LinkedHashMap<>();
        if (schema == null) {
            errors.put("schema", "Form schema is required");
            throw new FieldValidationException("Invalid form", errors);
        }
        if (schema.getTitle() == null || schema.getTitle().isBlank()) {
            errors.put("title", "Title is required");
        }
        List<FormField> fields = schema.getFields() == null ? List.of() : schema.getFields();
        Set<String> ids = new HashSet<>();
        for (int i = 0; i < fields.size(); i++) {
            FormField field = fields.get(i);
            String path = "fields[" + i + "]";
            if (field == null) {
                errors.put(path, "Field is empty");
                continue;
            }
            if (field.getId() == null || field.getId().isBlank()) {
                errors.put(path + ".id", "Field id is required");
            } else if (!ids.add(field.getId())) {
                errors.put(path + ".id", "Duplicate field id: " + field.getId());
            }
            validateFieldConfig(field, path, errors);
        }
        if (!errors.isEmpty()) throw new FieldValidationException("Invalid form", errors);
    }

    /**
     * Validates a single field's configuration in isolation (no id-uniqueness
     * check — that needs the rest of the form).
     *
     * @param field the field to check
     * @throws FieldValidationException listing every problem found
     * @since v.0.1
     */
    public static void validateField(FormField field) {
        Map<String, String> errors = new LinkedHashMap<>();
        if (field == null) {
            errors.put("field", "Field is required");
        } else {
            validateFieldConfig(field, "field", errors);
        }
        if (!errors.isEmpty()) throw new FieldValidationException("Invalid field", errors);
    }

    private static void validateFieldConfig(FormField field, String path, Map<String, String> errors) {
        FieldType type = field.getType();
        if (type == null) {
            errors.put(path + ".type", "Field type is required");
            return;
        }
        if (field.getLabel() == null || field.getLabel().isBlank()) {
            errors.put(path + ".label", "Label is required");
        }
        if (type == FieldType.SECTION_BREAK && field.isRequired()) {
            errors.put(path + ".required", "A section break can't be required");
        }
        if (CHOICE_TYPES.contains(type)) {
            List<String> options = field.getOptions() == null ? List.of() : field.getOptions().stream()
                    .filter(Objects::nonNull).map(String::trim).filter(o -> !o.isEmpty()).toList();
            if (options.size() < 2) {
                errors.put(path + ".options", "Needs at least 2 options");
            } else if (new HashSet<>(options).size() != options.size()) {
                errors.put(path + ".options", "Options must be unique");
            }
        }
        if (type == FieldType.RATING && field.getMax() != null
                && (field.getMax() < 2 || field.getMax() > RATING_MAX_SCALE)) {
            errors.put(path + ".max", "Rating scale must be between 2 and " + RATING_MAX_SCALE);
        }
        if (LENGTH_TYPES.contains(type)) {
            if (field.getMin() != null && field.getMin() < 0) errors.put(path + ".min", "Can't be negative");
            if (field.getMax() != null && field.getMax() < 1) errors.put(path + ".max", "Must be at least 1");
        }
        if (field.getMin() != null && field.getMax() != null && field.getMin() > field.getMax()) {
            errors.put(path + ".min", "Min can't be greater than max");
        }
    }
}
