package me.marensovich.gta5rpformapp.backend.service.export;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField.FieldType;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import me.marensovich.gta5rpformapp.backend.database.entity.SubmissionFile;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionFileRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Exports a form's submissions as CSV (E3.3, #87).
 * <p>
 * Streams: submissions are read a slice at a time and written straight to
 * the response, so memory use doesn't grow with the number of submissions
 * (spec раздел 8). One column per input field of the form as it is now, in
 * form order, after fixed columns (ID, time, status, author); then one per
 * field that is gone from the form but was asked in earlier submissions
 * (their question snapshots, #117), headed by the label they had then. A
 * cell is read by the field as its own submission asked it.
 * </p>
 * <p>
 * UTF-8 with a BOM so Excel detects the encoding. Cells that a spreadsheet
 * would read as a formula ({@code = + - @}, tab, CR) are prefixed with a
 * quote, so a respondent can't plant a formula in the owner's spreadsheet
 * (CSV injection).
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class CsvExportService {

    static final int SLICE_SIZE = 500;
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    /** A negative number is data, not a formula: left as is. */
    private static final Pattern PLAIN_NUMBER = Pattern.compile("^-\\d+(\\.\\d+)?$");

    private final SubmissionRepository submissionRepository;
    private final UserRepository userRepository;
    private final SubmissionFileRepository submissionFileRepository;

    /**
     * Writes the form's submissions, oldest first, as CSV.
     *
     * @param form the form
     * @param out  where to write; not closed
     * @throws IOException if writing fails (e.g. the client went away)
     * @since v.0.1
     */
    public void write(Form form, OutputStream out) throws IOException {
        List<FormField> fields = columns(form);

        Writer writer = new OutputStreamWriter(out, StandardCharsets.UTF_8);
        writer.write('﻿');

        List<String> header = new ArrayList<>(List.of("Submission ID", "Submitted at", "Status", "Discord ID", "Username"));
        fields.forEach(f -> header.add(f.getLabel() != null ? f.getLabel() : f.getId()));
        header.addAll(List.of("Moderator comment", "Decided at"));
        writeRow(writer, header);

        int page = 0;
        Slice<Submission> slice;
        do {
            slice = submissionRepository.readAllByFormId(form.getId(),
                    PageRequest.of(page++, SLICE_SIZE, Sort.by("createdAt").ascending().and(Sort.by("id"))));
            List<Submission> submissions = slice.getContent();
            Map<Long, String> usernames = usernames(submissions.stream().map(Submission::getDiscordId)
                    .filter(Objects::nonNull).collect(Collectors.toSet()));
            Map<UUID, String> fileNames = fileNames(submissions.stream().map(Submission::getId).toList());

            for (Submission s : submissions) {
                List<String> row = new ArrayList<>();
                row.add(s.getId().toString());
                row.add(s.getCreatedAt() != null ? s.getCreatedAt().format(TIME) : "");
                row.add(s.getStatus() != null ? s.getStatus().name() : "");
                row.add(s.getDiscordId() != null ? s.getDiscordId().toString() : "");
                row.add(s.getDiscordId() != null ? usernames.getOrDefault(s.getDiscordId(), "") : "");
                Map<String, Object> answers = s.getAnswers() != null ? s.getAnswers() : Map.of();
                Map<String, FormField> asked = byId(inputFields(s.questions(form)));
                for (FormField f : fields) {
                    row.add(cell(asked.getOrDefault(f.getId(), f), answers.get(f.getId()), fileNames));
                }
                row.add(s.getModeratorComment() != null ? s.getModeratorComment() : "");
                row.add(s.getDecidedAt() != null ? s.getDecidedAt().format(TIME) : "");
                writeRow(writer, row);
            }
            writer.flush();
        } while (slice.hasNext());
    }

    /**
     * The form's input fields as they are now, then the ones only earlier
     * submissions asked, in the order they were first met (oldest first).
     */
    private List<FormField> columns(Form form) {
        Map<String, FormField> columns = new LinkedHashMap<>(byId(inputFields(form.getSchema())));
        int page = 0;
        Slice<Submission> slice;
        do {
            slice = submissionRepository.readAllByFormId(form.getId(),
                    PageRequest.of(page++, SLICE_SIZE, Sort.by("createdAt").ascending().and(Sort.by("id"))));
            for (Submission s : slice.getContent()) {
                if (s.getSchemaSnapshot() == null) continue;
                inputFields(s.getSchemaSnapshot()).forEach(f -> columns.putIfAbsent(f.getId(), f));
            }
        } while (slice.hasNext());
        return List.copyOf(columns.values());
    }

    private static List<FormField> inputFields(FormSchema schema) {
        if (schema == null || schema.getFields() == null) return List.of();
        return schema.getFields().stream()
                .filter(f -> f != null && f.getId() != null && f.getType() != null && f.getType().isInput())
                .toList();
    }

    private static Map<String, FormField> byId(List<FormField> fields) {
        Map<String, FormField> map = new LinkedHashMap<>();
        fields.forEach(f -> map.putIfAbsent(f.getId(), f));
        return map;
    }

    private static String cell(FormField field, Object value, Map<UUID, String> fileNames) {
        if (value == null) return "";
        if (field.getType() == FieldType.FILE_UPLOAD) {
            return (value instanceof Collection<?> c ? c.stream() : java.util.stream.Stream.of(value)).map(id -> {
                try {
                    return fileNames.getOrDefault(UUID.fromString(id.toString()), "");
                } catch (IllegalArgumentException e) {
                    return "";
                }
            }).filter(n -> !n.isEmpty()).collect(Collectors.joining("; "));
        }
        if (value instanceof Collection<?> c) {
            return c.stream().map(String::valueOf).collect(Collectors.joining("; "));
        }
        if (value instanceof Boolean b) return b ? "yes" : "no";
        return value.toString();
    }

    private Map<Long, String> usernames(Collection<Long> discordIds) {
        if (discordIds.isEmpty()) return Map.of();
        return userRepository.findAllByDiscordIdIn(discordIds).stream()
                .collect(Collectors.toMap(User::getDiscordId, User::getDiscordUsername, (a, b) -> a));
    }

    private Map<UUID, String> fileNames(Collection<UUID> submissionIds) {
        if (submissionIds.isEmpty()) return Map.of();
        Map<UUID, String> names = new HashMap<>();
        for (SubmissionFile f : submissionFileRepository.findAllBySubmissionIdIn(submissionIds)) {
            names.put(f.getId(), f.getOriginalName());
        }
        return names;
    }

    static void writeRow(Writer writer, List<String> cells) throws IOException {
        for (int i = 0; i < cells.size(); i++) {
            if (i > 0) writer.write(',');
            writer.write(escape(cells.get(i)));
        }
        writer.write("\r\n");
    }

    /** RFC 4180 quoting, plus neutralizing formula-looking cells. */
    static String escape(String value) {
        String v = value == null ? "" : value;
        if (!v.isEmpty() && "=+-@\t\r".indexOf(v.charAt(0)) >= 0 && !PLAIN_NUMBER.matcher(v).matches()) v = "'" + v;
        if (v.contains(",") || v.contains("\"") || v.contains("\n") || v.contains("\r")) {
            v = "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }
}
