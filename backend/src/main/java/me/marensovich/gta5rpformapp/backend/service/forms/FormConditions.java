package me.marensovich.gta5rpformapp.backend.service.forms;

import me.marensovich.gta5rpformapp.backend.data.forms.FieldCondition;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Evaluates branching conditions (E3.1): which fields of a form are shown
 * for a given set of answers. Mirrored by {@code frontend/src/components/form/conditions.ts};
 * the two must agree, or a respondent could be asked for a field the server
 * then ignores (or the reverse).
 * <p>
 * Visibility is transitive: a field whose controlling field is hidden sees
 * that field's answer as empty, so hiding a question also hides whatever
 * depends on it.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public final class FormConditions {

    private FormConditions() {
    }

    /**
     * The ids of the fields shown for these answers.
     *
     * @param fields  the form's fields
     * @param answers answers keyed by field id
     * @return the visible field ids, in form order
     * @since v.0.1
     */
    public static Set<String> visibleFieldIds(List<FormField> fields, Map<String, Object> answers) {
        Map<String, FormField> byId = new HashMap<>();
        for (FormField f : fields) {
            if (f != null && f.getId() != null) byId.put(f.getId(), f);
        }
        Map<String, Boolean> memo = new HashMap<>();
        Set<String> visible = new LinkedHashSet<>();
        for (FormField f : fields) {
            if (f != null && f.getId() != null && isVisible(f.getId(), byId, answers, memo, new HashSet<>())) {
                visible.add(f.getId());
            }
        }
        return visible;
    }

    private static boolean isVisible(String id, Map<String, FormField> byId, Map<String, Object> answers,
                                     Map<String, Boolean> memo, Set<String> visiting) {
        Boolean known = memo.get(id);
        if (known != null) return known;
        FormField field = byId.get(id);
        if (field == null) return false;
        FieldCondition c = field.getCondition();
        boolean result;
        if (c == null) {
            result = true;
        } else if (!visiting.add(id)) {
            result = false; // a cycle: rejected on save, but never loop forever
        } else {
            boolean controllerVisible = c.getFieldId() != null
                    && isVisible(c.getFieldId(), byId, answers, memo, visiting);
            Object answer = controllerVisible ? answers.get(c.getFieldId()) : null;
            result = matches(c, answer);
            visiting.remove(id);
        }
        memo.put(id, result);
        return result;
    }

    /**
     * Whether an answer satisfies a condition.
     *
     * @param condition the condition
     * @param answer    the controlling field's answer, {@code null} if none
     * @return {@code true} if the dependent field should be shown
     * @since v.0.1
     */
    public static boolean matches(FieldCondition condition, Object answer) {
        if (condition.getOperator() == null) return true;
        List<String> values = asStrings(answer);
        String expected = condition.getValue() == null ? "" : condition.getValue().trim();
        String expectedLower = expected.toLowerCase(Locale.ROOT);
        return switch (condition.getOperator()) {
            case EMPTY -> values.isEmpty();
            case NOT_EMPTY -> !values.isEmpty();
            case EQUALS -> values.stream().anyMatch(v -> v.equalsIgnoreCase(expected));
            case NOT_EQUALS -> values.stream().noneMatch(v -> v.equalsIgnoreCase(expected));
            case CONTAINS -> values.stream().anyMatch(v -> v.toLowerCase(Locale.ROOT).contains(expectedLower));
            case GREATER_THAN -> {
                Integer cmp = compareNumber(values, expected);
                yield cmp != null && cmp > 0;
            }
            case LESS_THAN -> {
                Integer cmp = compareNumber(values, expected);
                yield cmp != null && cmp < 0;
            }
        };
    }

    private static Integer compareNumber(List<String> values, String expected) {
        if (values.isEmpty()) return null;
        Double actual = parse(values.getFirst());
        Double threshold = parse(expected);
        if (actual == null || threshold == null) return null;
        return Double.compare(actual, threshold);
    }

    private static Double parse(String s) {
        try {
            double d = Double.parseDouble(s.trim());
            return Double.isFinite(d) ? d : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * An answer as a list of strings: empty for no answer, a blank text or
     * an unticked checkbox; one entry per chosen option for a multi-choice.
     *
     * @param answer the raw or normalized answer
     * @return its string values
     * @since v.0.1
     */
    static List<String> asStrings(Object answer) {
        List<String> out = new ArrayList<>();
        if (answer == null || Boolean.FALSE.equals(answer)) return out;
        if (answer instanceof Collection<?> c) {
            for (Object o : c) {
                String s = scalar(o);
                if (s != null) out.add(s);
            }
            return out;
        }
        String s = scalar(answer);
        if (s != null) out.add(s);
        return out;
    }

    private static String scalar(Object o) {
        if (o == null || Boolean.FALSE.equals(o)) return null;
        if (o instanceof Number n) {
            double d = n.doubleValue();
            return d == Math.floor(d) && !Double.isInfinite(d) ? Long.toString((long) d) : Double.toString(d);
        }
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }

    /**
     * Finds a dependency cycle among conditions (A shown if B, B shown if A).
     *
     * @param fields the form's fields
     * @return the ids along the cycle, first id repeated at the end; empty if none
     * @since v.0.1
     */
    public static List<String> findCycle(List<FormField> fields) {
        Map<String, String> dependsOn = new HashMap<>();
        for (FormField f : fields) {
            if (f != null && f.getId() != null && f.getCondition() != null && f.getCondition().getFieldId() != null) {
                dependsOn.put(f.getId(), f.getCondition().getFieldId());
            }
        }
        Set<String> cleared = new HashSet<>();
        for (String start : dependsOn.keySet()) {
            List<String> path = new ArrayList<>();
            Set<String> onPath = new HashSet<>();
            String current = start;
            while (current != null && !cleared.contains(current)) {
                if (!onPath.add(current)) {
                    List<String> cycle = new ArrayList<>(path.subList(path.indexOf(current), path.size()));
                    cycle.add(current);
                    return cycle;
                }
                path.add(current);
                current = dependsOn.get(current);
            }
            cleared.addAll(path);
        }
        return List.of();
    }
}
