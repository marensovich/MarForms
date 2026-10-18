package me.marensovich.gta5rpformapp.backend.data.audit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * What a change changed, for the platform journal's diff (ТЗ 6.5, #146): a
 * list of {@code {field, before, after}} stored in the entry's metadata under
 * {@link #KEY}. Nested values are compared leaf by leaf, as paths such as
 * {@code schema.fields[3].required}. Secrets never reach it: a Discord
 * webhook URL keeps only its ID ({@code …/api/webhooks/123/***}).
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public final class AuditDiff {

    /** The metadata key the changes are stored under. */
    public static final String KEY = "diff";

    private static final int MAX_CHANGES = 100;
    private static final int MAX_VALUE = 500;
    private static final Pattern WEBHOOK = Pattern.compile("(https?://[^\\s\"']*/api/webhooks/\\d+/)[^\\s\"'/?]+");
    private static final ObjectMapper JSON = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .build();

    private final List<Map<String, Object>> changes = new ArrayList<>();

    /**
     * A value frozen as it is now, to compare with after the change.
     *
     * @param value any serialisable value
     * @return its tree, independent of later edits
     * @since v.0.1
     */
    public static JsonNode snapshot(Object value) {
        return JSON.valueToTree(value);
    }

    /**
     * Notes one field, if it changed. Collections compare as sets.
     *
     * @param field  the field's name
     * @param before the old value
     * @param after  the new value
     * @return this
     * @since v.0.1
     */
    public AuditDiff add(String field, Object before, Object after) {
        String a = text(before), b = text(after);
        if (!Objects.equals(a, b)) put(field, a, b);
        return this;
    }

    /**
     * Notes every leaf that differs between a snapshot and the value now.
     *
     * @param prefix the path the leaves go under, or empty
     * @param before {@link #snapshot} of the old value
     * @param after  the new value
     * @return this
     * @since v.0.1
     */
    public AuditDiff deep(String prefix, JsonNode before, Object after) {
        walk(prefix, before, JSON.valueToTree(after));
        return this;
    }

    public boolean isEmpty() {
        return changes.isEmpty();
    }

    public List<Map<String, Object>> changes() {
        return List.copyOf(changes);
    }

    /**
     * The metadata to store: {@code base} plus the changes, if any.
     *
     * @param base other metadata, may be {@code null}
     * @return the metadata, {@code null} if there is nothing at all
     * @since v.0.1
     */
    public Map<String, Object> into(Map<String, Object> base) {
        if (changes.isEmpty()) return base;
        Map<String, Object> out = base == null ? new LinkedHashMap<>() : new LinkedHashMap<>(base);
        out.put(KEY, changes());
        return out;
    }

    /** A webhook URL anywhere in the text keeps only its ID. */
    public static String mask(String text) {
        return text == null ? null : WEBHOOK.matcher(text).replaceAll("$1***");
    }

    private void walk(String path, JsonNode a, JsonNode b) {
        if (changes.size() >= MAX_CHANGES) return;
        a = a == null || a.isMissingNode() ? com.fasterxml.jackson.databind.node.NullNode.getInstance() : a;
        b = b == null || b.isMissingNode() ? com.fasterxml.jackson.databind.node.NullNode.getInstance() : b;
        if (a.equals(b)) return;
        if (a.isObject() && b.isObject()) {
            Set<String> keys = new LinkedHashSet<>();
            b.fieldNames().forEachRemaining(keys::add);
            a.fieldNames().forEachRemaining(keys::add);
            for (String k : keys) walk(path.isEmpty() ? k : path + "." + k, a.get(k), b.get(k));
            return;
        }
        if (a.isArray() && b.isArray() && isObjects(a) && isObjects(b)) {
            for (int i = 0; i < Math.max(a.size(), b.size()); i++) walk(path + "[" + i + "]", a.get(i), b.get(i));
            return;
        }
        put(path, text(a), text(b));
    }

    private static boolean isObjects(JsonNode array) {
        for (Iterator<JsonNode> it = array.elements(); it.hasNext(); ) if (!it.next().isObject()) return false;
        return true;
    }

    private void put(String field, String before, String after) {
        if (changes.size() >= MAX_CHANGES) return;
        Map<String, Object> change = new LinkedHashMap<>();
        change.put("field", field);
        change.put("before", before);
        change.put("after", after);
        changes.add(change);
    }

    private static String text(Object value) {
        if (value == null) return null;
        String s;
        if (value instanceof JsonNode node) {
            if (node.isNull() || node.isMissingNode()) return null;
            s = node.isValueNode() ? node.asText() : node.toString();
        } else if (value instanceof Collection<?> c) {
            s = c.stream().map(String::valueOf).sorted().toList().toString();
        } else {
            s = String.valueOf(value);
        }
        s = mask(s);
        return s.length() > MAX_VALUE ? s.substring(0, MAX_VALUE) + "…" : s;
    }
}
