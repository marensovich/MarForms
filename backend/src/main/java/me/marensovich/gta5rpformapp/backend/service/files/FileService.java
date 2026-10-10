package me.marensovich.gta5rpformapp.backend.service.files;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField.FieldType;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.SubmissionFile;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionFileRepository;
import me.marensovich.gta5rpformapp.backend.exception.FieldValidationException;
import me.marensovich.gta5rpformapp.backend.exception.FormAccessDeniedException;
import me.marensovich.gta5rpformapp.backend.exception.InvalidStateException;
import me.marensovich.gta5rpformapp.backend.exception.LoginRequiredException;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import me.marensovich.gta5rpformapp.backend.service.SubmissionService;
import me.marensovich.gta5rpformapp.backend.service.forms.FormAccessService;
import org.springframework.lang.Nullable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * File attachments (E3.2, ADR 0003): upload while a form is being filled
 * in, attach on submit, serve to moderators, clean up what was never used.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileService {

    private static final long MB = 1024L * 1024L;
    static final long UNATTACHED_TTL_HOURS = 24;

    private final SubmissionFileRepository fileRepository;
    private final FileStorage storage;
    private final FormAccessService formAccessService;

    /**
     * Uploads a file for one of a form's {@code FILE_UPLOAD} fields (#85).
     * Checked like a submission (the form accepts answers, the viewer may
     * fill it in), then against the field's extensions and size limit.
     *
     * @param form    the form
     * @param fieldId the field the file is for
     * @param file    the uploaded file
     * @param user    the uploader, {@code null} if not logged in
     * @return the stored file's metadata; its ID is the field's answer
     * @since v.0.1
     */
    @Transactional
    public SubmissionFile upload(Form form, String fieldId, MultipartFile file, @Nullable User user) {
        String notAccepting = SubmissionService.notAcceptingReason(form);
        if (notAccepting != null) throw new InvalidStateException(notAccepting);
        switch (formAccessService.check(form, user)) {
            case LOGIN_REQUIRED -> throw new LoginRequiredException("Log in with Discord to fill in this form");
            case NOT_IN_GUILD -> throw new FormAccessDeniedException("You must be a member of this server to fill in this form");
            case BANNED -> throw new FormAccessDeniedException("You are banned from submitting forms on this server");
            case GRANTED -> {
            }
        }

        FormField field = fileField(form, fieldId);
        if (file == null || file.isEmpty()) throw fieldError(fieldId, "The file is empty");

        long limitMb = Math.min(field.getMaxFileSizeMb() != null ? field.getMaxFileSizeMb() : FileRules.DEFAULT_SIZE_MB,
                FileRules.MAX_SIZE_MB);
        if (file.getSize() > limitMb * MB) throw fieldError(fieldId, "The file is larger than " + limitMb + " MB");

        String name = cleanName(file.getOriginalFilename());
        String extension = FileRules.extensionOf(name);
        List<String> allowed = allowedExtensions(field);
        if (extension.isEmpty() || !allowed.contains(extension) || FileRules.BLOCKED_EXTENSIONS.contains(extension)) {
            throw fieldError(fieldId, "Allowed file types: " + String.join(", ", allowed));
        }

        String key = UUID.randomUUID().toString();
        try (InputStream in = file.getInputStream()) {
            storage.store(key, in);
        } catch (IOException e) {
            log.error("Failed to store an upload for form {}: {}", form.getId(), e.getMessage());
            throw new IllegalStateException("Couldn't save the file, try again");
        }

        SubmissionFile row = new SubmissionFile();
        row.setFormId(form.getId());
        row.setFieldId(fieldId);
        row.setOriginalName(name);
        row.setContentType(file.getContentType() != null && file.getContentType().length() <= 100
                ? file.getContentType() : null);
        row.setSizeBytes(file.getSize());
        row.setStorageKey(key);
        row.setUploadedBy(user != null && form.getAccessMode() != FormAccessMode.ANONYMOUS ? user.getDiscordId() : null);
        return fileRepository.save(row);
    }

    /**
     * Checks the file answers of a submission about to be made: each must
     * be an upload for this form and field that no submission uses yet.
     *
     * @param form    the form
     * @param answers the cleaned answers
     * @return the files to attach once the submission is saved
     * @throws FieldValidationException naming each field whose file is unusable
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public List<SubmissionFile> resolveAnswerFiles(Form form, Map<String, Object> answers) {
        List<SubmissionFile> files = new ArrayList<>();
        Map<String, String> errors = new LinkedHashMap<>();
        for (FormField field : form.getSchema().getFields()) {
            if (field == null || field.getType() != FieldType.FILE_UPLOAD) continue;
            Object answer = answers.get(field.getId());
            if (answer == null) continue;
            SubmissionFile file = fileRepository.findById(UUID.fromString(answer.toString())).orElse(null);
            if (file == null || !file.getFormId().equals(form.getId()) || !file.getFieldId().equals(field.getId())
                    || file.getSubmissionId() != null) {
                errors.put(field.getId(), "Upload the file again");
            } else {
                files.add(file);
            }
        }
        if (!errors.isEmpty()) throw new FieldValidationException("Some answers are invalid", errors);
        return files;
    }

    /**
     * Attaches files to a newly saved submission.
     *
     * @param files        from {@link #resolveAnswerFiles}
     * @param submissionId the submission
     * @since v.0.1
     */
    @Transactional
    public void attach(List<SubmissionFile> files, UUID submissionId) {
        for (SubmissionFile file : files) {
            file.setSubmissionId(submissionId);
            fileRepository.save(file);
        }
    }

    /**
     * A submission's files, for the moderation card.
     *
     * @param submissionId the submission
     * @return its files
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public List<SubmissionFile> forSubmission(UUID submissionId) {
        return fileRepository.findAllBySubmissionId(submissionId);
    }

    /**
     * A file's metadata.
     *
     * @param id the file's ID
     * @return the file
     * @throws NotFoundException if there is none
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public SubmissionFile get(UUID id) {
        return fileRepository.findById(id).orElseThrow(() -> new NotFoundException("File not found"));
    }

    /**
     * Opens a file's bytes; the caller closes the stream.
     *
     * @param file the file
     * @return its bytes
     * @throws NotFoundException if the bytes are gone from storage
     * @since v.0.1
     */
    public InputStream open(SubmissionFile file) {
        try {
            return storage.open(file.getStorageKey());
        } catch (IOException e) {
            throw new NotFoundException("File not found");
        }
    }

    /**
     * Deletes a submission's files, bytes included (when the submission is
     * deleted).
     *
     * @param submissionId the submission
     * @since v.0.1
     */
    @Transactional
    public void deleteForSubmission(UUID submissionId) {
        fileRepository.findAllBySubmissionId(submissionId).forEach(this::remove);
    }

    /**
     * Removes uploads never attached within {@value #UNATTACHED_TTL_HOURS}
     * hours (abandoned forms, answers hidden by branching), and files whose
     * submission no longer exists.
     *
     * @since v.0.1
     */
    @Scheduled(fixedDelay = 60 * 60 * 1000L, initialDelay = 5 * 60 * 1000L)
    @Transactional
    public void cleanUp() {
        List<SubmissionFile> stale = new ArrayList<>(fileRepository
                .findAllBySubmissionIdIsNullAndCreatedAtBefore(LocalDateTime.now().minusHours(UNATTACHED_TTL_HOURS)));
        stale.addAll(fileRepository.findAllWithMissingSubmission());
        if (!stale.isEmpty()) log.info("Removing {} unused uploaded file(s)", stale.size());
        stale.forEach(this::remove);
    }

    private void remove(SubmissionFile file) {
        try {
            storage.delete(file.getStorageKey());
        } catch (IOException e) {
            log.warn("Failed to delete stored file {}: {}", file.getId(), e.getMessage());
            return;
        }
        fileRepository.delete(file);
    }

    private static FormField fileField(Form form, String fieldId) {
        return form.getSchema().getFields().stream()
                .filter(f -> f != null && f.getId() != null && f.getId().equals(fieldId))
                .filter(f -> f.getType() == FieldType.FILE_UPLOAD)
                .findFirst()
                .orElseThrow(() -> new NotFoundException("This form has no file field " + fieldId));
    }

    private static List<String> allowedExtensions(FormField field) {
        List<String> configured = field.getAllowedExtensions() == null ? List.of() : field.getAllowedExtensions().stream()
                .map(FileRules::normalizeExtension).filter(e -> e != null).distinct().toList();
        return configured.isEmpty() ? FileRules.DEFAULT_EXTENSIONS : configured;
    }

    /** The name shown to moderators: no path, no control characters, bounded length. */
    static String cleanName(String original) {
        String name = original == null ? "" : original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}\"]", "").trim();
        if (name.isEmpty()) name = "file";
        if (name.length() > 200) {
            String ext = FileRules.extensionOf(name);
            name = name.substring(0, 190) + (ext.isEmpty() ? "" : "." + ext);
        }
        return name;
    }

    private static FieldValidationException fieldError(String fieldId, String message) {
        return new FieldValidationException("Invalid file", Map.of(fieldId, message));
    }
}
