package me.marensovich.gta5rpformapp.backend.service.forms;

import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField.FieldType;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.exception.FieldValidationException;

import java.net.URI;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Server-side validation of submitted answers against a form's schema
 * (task #49) — independent of the client, which may be bypassed.
 * <p>
 * Mirrors the public renderer's rules: required fields, per-type format,
 * length/range limits and allowed options. Returns a <b>cleaned</b> answer
 * map: only the schema's input fields are kept (unknown keys and section
 * breaks are dropped), so nothing unexpected reaches storage, webhooks or
 * moderators.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public final class SubmissionAnswerValidator {

    /** Defaults when the form creator left min/max unset — same as the renderer. */
    static final int DEFAULT_TEXT_MAX = 255;
    static final int DEFAULT_TEXTAREA_MAX = 10_000;
    static final int DEFAULT_RATING_SCALE = 5;

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern PHONE = Pattern.compile("^[+\\d][\\d\\s\\-().]{5,18}$");
    private static final Pattern TIME = Pattern.compile("^\\d{2}:\\d{2}(:\\d{2})?$");

    private SubmissionAnswerValidator() {
    }

    /**
     * Validates and cleans a set of answers.
     *
     * @param schema  the form's schema
     * @param answers the raw answers keyed by field id ({@code null} = none)
     * @return the cleaned answers (input fields only, empty optional answers omitted)
     * @throws FieldValidationException with one message per offending field id
     * @since v.0.1
     */
    public static Map<String, Object> validate(FormSchema schema, Map<String, Object> answers) {
        Map<String, Object> raw = answers == null ? Map.of() : answers;
        Map<String, Object> clean = new LinkedHashMap<>();
        Map<String, String> errors = new LinkedHashMap<>();
        List<FormField> fields = schema == null || schema.getFields() == null ? List.of() : schema.getFields();

        for (FormField field : fields) {
            if (field == null || field.getType() == null || !field.getType().isInput()) continue;
            Object value = raw.get(field.getId());
            if (isEmpty(value)) {
                if (field.isRequired()) errors.put(field.getId(), requiredMessage(field.getType()));
                continue;
            }
            String error = checkType(field, value);
            if (error != null) {
                errors.put(field.getId(), error);
            } else {
                clean.put(field.getId(), normalize(field, value));
            }
        }

        if (!errors.isEmpty()) throw new FieldValidationException("Some answers are invalid", errors);
        return clean;
    }

    private static boolean isEmpty(Object value) {
        if (value == null || Boolean.FALSE.equals(value)) return true;
        if (value instanceof String s) return s.isBlank();
        if (value instanceof Collection<?> c) return c.isEmpty();
        return false;
    }

    private static String requiredMessage(FieldType type) {
        return switch (type) {
            case BOOLEAN -> "Please confirm this field";
            case SELECT, RADIO, MULTI_SELECT, CHECKBOX, RATING -> "Please choose an option";
            default -> "This field is required";
        };
    }

    private static String checkType(FormField field, Object value) {
        return switch (field.getType()) {
            case TEXT, TEXTAREA, PASSWORD -> {
                if (!(value instanceof String s)) yield "Must be text";
                int max = field.getMax() != null ? field.getMax()
                        : field.getType() == FieldType.TEXTAREA ? DEFAULT_TEXTAREA_MAX : DEFAULT_TEXT_MAX;
                int length = s.trim().length();
                if (field.getMin() != null && length < field.getMin()) yield "At least " + field.getMin() + " characters";
                if (length > max) yield "At most " + max + " characters";
                yield null;
            }
            case NUMBER -> {
                Double n = toNumber(value);
                if (n == null) yield "Must be a number";
                if (field.getMin() != null && n < field.getMin()) yield "Must be at least " + field.getMin();
                if (field.getMax() != null && n > field.getMax()) yield "Must be at most " + field.getMax();
                yield null;
            }
            case EMAIL -> value instanceof String s && EMAIL.matcher(s.trim()).matches() ? null : "Invalid email address";
            case PHONE -> value instanceof String s && PHONE.matcher(s.trim()).matches() ? null : "Invalid phone number";
            case URL -> value instanceof String s && isUrl(s.trim()) ? null : "Invalid URL";
            case SELECT, RADIO -> value instanceof String s && options(field).contains(s) ? null : "Not one of the options";
            case MULTI_SELECT -> value instanceof Collection<?> c && allOptions(field, c) ? null : "Not one of the options";
            case CHECKBOX -> {
                // Rendered as a single tick box today; a list of options is accepted too.
                if (value instanceof Boolean) yield null;
                yield value instanceof Collection<?> c && allOptions(field, c) ? null : "Not one of the options";
            }
            case BOOLEAN -> value instanceof Boolean ? null : "Must be yes or no";
            case DATE -> parses(value, s -> LocalDate.parse(s)) ? null : "Invalid date";
            case TIME -> value instanceof String s && TIME.matcher(s).matches()
                    && parses(value, LocalTime::parse) ? null : "Invalid time";
            case DATETIME -> parses(value, SubmissionAnswerValidator::parseDateTime) ? null : "Invalid date and time";
            case RATING -> {
                Double n = toNumber(value);
                int scale = field.getMax() != null ? field.getMax() : DEFAULT_RATING_SCALE;
                yield n != null && n == Math.floor(n) && n >= 1 && n <= scale ? null : "Must be between 1 and " + scale;
            }
            case SECTION_BREAK -> null;
        };
    }

    private static Object normalize(FormField field, Object value) {
        return switch (field.getType()) {
            case NUMBER -> {
                double n = toNumber(value);
                yield n == Math.floor(n) && !Double.isInfinite(n) ? (Object) (long) n : (Object) n;
            }
            case RATING -> toNumber(value).intValue();
            case TEXT, TEXTAREA, EMAIL, PHONE, URL -> ((String) value).trim();
            default -> value;
        };
    }

    private static Double toNumber(Object value) {
        if (value instanceof Number n) return n.doubleValue();
        if (value instanceof String s) {
            try {
                double d = Double.parseDouble(s.trim());
                return Double.isFinite(d) ? d : null;
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private static List<String> options(FormField field) {
        return field.getOptions() == null ? List.of() : field.getOptions();
    }

    private static boolean allOptions(FormField field, Collection<?> values) {
        List<String> allowed = options(field);
        return values.stream().allMatch(v -> v instanceof String s && allowed.contains(s));
    }

    private static boolean isUrl(String s) {
        try {
            URI uri = URI.create(s);
            return uri.getScheme() != null && (uri.getScheme().equals("http") || uri.getScheme().equals("https"))
                    && uri.getHost() != null;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static Object parseDateTime(String s) {
        try {
            return LocalDateTime.parse(s);
        } catch (DateTimeParseException e) {
            return OffsetDateTime.parse(s);
        }
    }

    private static boolean parses(Object value, java.util.function.Function<String, Object> parser) {
        if (!(value instanceof String s)) return false;
        try {
            parser.apply(s.trim());
            return true;
        } catch (DateTimeParseException e) {
            return false;
        }
    }
}
