package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.service.FormService;
import me.marensovich.gta5rpformapp.backend.service.export.CsvExportService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Exports a form's submissions (E3.3, #87). Owner-only: spec раздел 2 marks
 * export for moderators as optional, so it starts with the narrower choice.
 * Platform admins with {@code RESPONSES_MANAGE} may export too.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/forms/{formId}/export")
@RequiredArgsConstructor
public class FormExportController {

    private final FormService formService;
    private final CsvExportService csvExportService;

    /**
     * Streams the form's submissions as a download.
     *
     * @param formId the form's ID
     * @param format the format; only {@code csv} for now
     * @return the file, written as it is read
     * @since v.0.1
     */
    @PreAuthorize("hasAuthority('RESPONSES_MANAGE') or @guildAccess.hasRoleForForm(#formId, 'OWNER')")
    @GetMapping
    public ResponseEntity<StreamingResponseBody> export(@PathVariable UUID formId,
                                                        @RequestParam(defaultValue = "csv") String format) {
        if (!"csv".equalsIgnoreCase(format)) {
            throw new IllegalArgumentException("Unsupported export format: " + format + " (supported: csv)");
        }
        Form form = formService.getById(formId);
        String name = fileBaseName(form) + "-" + LocalDate.now() + ".csv";
        StreamingResponseBody body = out -> csvExportService.write(form, out);
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(name, StandardCharsets.UTF_8).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(body);
    }

    private static String fileBaseName(Form form) {
        if (form.getSlug() != null) return form.getSlug();
        String title = form.getSchema() != null && form.getSchema().getTitle() != null ? form.getSchema().getTitle() : "";
        String cleaned = title.replaceAll("[^\\p{L}\\p{N}]+", "-").replaceAll("(^-|-$)", "");
        return cleaned.isEmpty() ? "submissions" : cleaned;
    }
}
