package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookHealth;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.dto.form.CreateFormRequest;
import me.marensovich.gta5rpformapp.backend.dto.form.CreateGuildFormRequest;
import me.marensovich.gta5rpformapp.backend.dto.form.FormSettingsRequest;
import me.marensovich.gta5rpformapp.backend.dto.form.FormSummaryDto;
import me.marensovich.gta5rpformapp.backend.dto.form.UpdateFormRequest;
import me.marensovich.gta5rpformapp.backend.exception.InvalidStateException;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import me.marensovich.gta5rpformapp.backend.service.billing.PlanLimitService;
import me.marensovich.gta5rpformapp.backend.service.billing.PlanMetric;
import me.marensovich.gta5rpformapp.backend.service.forms.FormSchemaValidator;
import me.marensovich.gta5rpformapp.backend.service.forms.SlugGenerator;
import me.marensovich.gta5rpformapp.backend.exception.FieldValidationException;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordWebhookUrl;
import me.marensovich.gta5rpformapp.backend.service.discord.WebhookUrlCipher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for managing forms.
 * <p>
 * Provides business logic for creating, retrieving, updating, publishing and
 * deleting forms and their fields, as well as listing forms with submission
 * statistics.
 * </p>
 * <p>
 * Two entry points coexist:
 * <ul>
 *     <li><b>Guild-scoped</b> ({@code /api/v1/guilds/{guildId}/forms}, the
 *     owner panel) — forms start as {@code DRAFT} and go live via
 *     {@link #publish}. Every guild-scoped lookup goes through
 *     {@link #getInGuild}, so a form ID from another guild is a 404 even
 *     for someone who owns the guild in the URL.</li>
 *     <li><b>Legacy platform-admin</b> ({@code /api/v1/forms}) — kept as is:
 *     a created form is published immediately, and {@code active} toggles
 *     publish/close.</li>
 * </ul>
 * Every schema write is checked by {@link FormSchemaValidator}.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Service
@RequiredArgsConstructor
public class FormService {

    private static final int SLUG_ATTEMPTS = 10;
    /** Upper bound of each RoleGate list — Discord itself caps a guild at 250 roles. */
    private static final int MAX_ROLE_GATE_ROLES = 50;

    private final FormRepository formRepository;
    private final SubmissionRepository submissionRepository;
    private final AuditLogService auditLogService;
    private final PlanLimitService planLimitService;
    private final me.marensovich.gta5rpformapp.backend.service.files.FileService fileService;
    private final org.springframework.transaction.support.TransactionTemplate transactionTemplate;
    private final me.marensovich.gta5rpformapp.backend.database.repository.FormReminderRepository formReminderRepository;

    // ── Lookup ──────────────────────────────────────────────────────────────

    /**
     * Retrieves a form by its ID.
     *
     * @param formId the UUID of the form to retrieve
     * @return the {@link Form} entity
     * @throws NotFoundException if the form does not exist
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public Form getById(UUID formId) {
        return formRepository.findById(formId)
                .orElseThrow(() -> new NotFoundException("Form not found: " + formId));
    }

    /**
     * Retrieves a form, but only if it belongs to the given guild.
     *
     * @param guildId the Discord guild snowflake ID from the URL
     * @param formId  the form's ID
     * @return the form
     * @throws NotFoundException if the form doesn't exist or belongs to another guild
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public Form getInGuild(Long guildId, UUID formId) {
        Form form = getById(formId);
        if (!guildId.equals(form.getServerId())) {
            throw new NotFoundException("Form not found: " + formId);
        }
        return form;
    }

    /**
     * Lists a guild's forms for the owner panel.
     *
     * @param guildId         the Discord guild snowflake ID
     * @param includeArchived whether archived forms are included
     * @param pageable        pagination parameters
     * @return form summaries with submission counts
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public Page<FormSummaryDto> listByGuild(Long guildId, boolean includeArchived, Pageable pageable) {
        Page<Form> page = includeArchived
                ? formRepository.findAllByServerId(guildId, pageable)
                : formRepository.findAllByServerIdAndStatusNot(guildId, FormStatus.ARCHIVED, pageable);
        return page.map(form -> FormSummaryDto.from(form, submissionRepository.countByFormId(form.getId())));
    }

    /**
     * Retrieves a paginated list of all forms for the dashboard.
     * <p>
     * Each form entry includes the total number of submissions for that form.
     * </p>
     *
     * @param pageable pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link FormSummaryDto} containing form summaries with submission counts
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public Page<FormSummaryDto> listForDashboard(Pageable pageable) {
        return formRepository.findAll(pageable)
                .map(form -> FormSummaryDto.from(form, submissionRepository.countByFormId(form.getId())));
    }

    // ── Create / update / delete ────────────────────────────────────────────

    /**
     * Creates a new form via the legacy platform-admin endpoint.
     * <p>
     * Preserves the original behaviour: the form is live right away (it is
     * published immediately, which also requires at least one field).
     * </p>
     *
     * @param request the {@link CreateFormRequest} containing form details
     * @return the created {@link Form} entity
     * @since v.0.1
     */
    @Transactional
    public Form create(CreateFormRequest request) {
        Long guildId = Long.parseUnsignedLong(request.serverId());
        // Published straight away, so it counts against the plan like any active form (#103).
        planLimitService.requireRoomFor(guildId, PlanMetric.ACTIVE_FORMS);
        Form form = newForm(guildId, request.schema(),
                request.channelsIds(), request.webhooks(), null);
        requirePublishable(form);
        assignSlugIfMissing(form);
        form.setStatus(FormStatus.PUBLISHED);
        return saveNew(form);
    }

    /**
     * Creates a new {@code DRAFT} form in a guild (owner panel).
     *
     * @param guildId the Discord guild snowflake ID
     * @param request the form's initial content
     * @return the created form
     * @since v.0.1
     */
    @Transactional
    public Form createInGuild(Long guildId, CreateGuildFormRequest request) {
        planLimitService.requireRoomFor(guildId, PlanMetric.ACTIVE_FORMS);
        Form form = newForm(guildId, request.schema(), request.channelsIds(), request.webhooks(), request.accessMode());
        applyRoleGate(form, request.allowedRoleIds(), request.deniedRoleIds());
        return saveNew(form);
    }

    private Form newForm(Long guildId, FormSchema schema, Set<String> channelsIds,
                         List<WebhookConfig> webhooks, FormAccessMode accessMode) {
        FormSchemaValidator.validate(schema);
        Form form = new Form();
        form.setServerId(guildId);
        form.setSchema(schema);
        if (channelsIds != null) form.setChannelsIds(parseIds(channelsIds));
        if (webhooks != null) form.setWebhooks(checkedWebhooks(webhooks, List.of()));
        if (accessMode != null) form.setAccessMode(accessMode);
        return form;
    }

    private Form saveNew(Form form) {
        Form saved = formRepository.save(form);
        // Creating a form grants nothing (#103): guild ownership comes only from a
        // bot install verified through Discord (GuildConnectService). Platform
        // staff creating a form for a guild manage it through FORMS_MANAGE.

        auditLogService.logByCurrentUser(AuditAction.FORM_CREATED,
                saved.getId().toString(), saved.getSchema().getTitle(),
                "Form ID: " + saved.getId());
        return saved;
    }

    /**
     * Updates an existing form.
     * <p>
     * Only fields that are not {@code null} in the request will be updated.
     * {@code active = true} publishes the form (same checks as
     * {@link #publish}); {@code active = false} closes it.
     * </p>
     *
     * @param formId  the UUID of the form to update
     * @param request the {@link UpdateFormRequest} containing updated fields
     * @return the updated {@link Form} entity
     * @throws NotFoundException if the form does not exist
     * @since v.0.1
     */
    @Transactional
    public Form update(UUID formId, UpdateFormRequest request) {
        Form form = getById(formId);
        if (request.version() != null && !request.version().equals(form.getVersion())) {
            throw new InvalidStateException("This form was changed elsewhere — reload it to see the latest version");
        }
        if (request.settings() != null) applySettings(form, request.settings());

        String oldTitle = form.getSchema().getTitle();
        FormStatus oldStatus = form.getStatus();
        int oldFieldCount = fieldCount(form);
        int oldWebhookCount = form.getWebhooks() != null ? form.getWebhooks().size() : 0;

        if (request.channelsIds() != null) {
            form.setChannelsIds(parseIds(request.channelsIds()));
        }
        if (request.webhooks() != null) {
            form.setWebhooks(checkedWebhooks(request.webhooks(), form.getWebhooks()));
        }
        if (request.schema() != null) {
            FormSchemaValidator.validate(request.schema());
            form.setSchema(request.schema());
        }
        if (request.active() != null) {
            if (request.active()) {
                requireNotArchived(form);
                requirePublishable(form);
                assignSlugIfMissing(form);
                form.setStatus(FormStatus.PUBLISHED);
            } else if (form.getStatus() == FormStatus.PUBLISHED) {
                form.setStatus(FormStatus.CLOSED);
            }
        }
        if (form.getStatus() == FormStatus.PUBLISHED) requirePublishable(form);

        Form saved = formRepository.save(form);

        List<String> changes = new ArrayList<>();
        String newTitle = saved.getSchema().getTitle();
        if (!oldTitle.equals(newTitle))
            changes.add("Title: \"" + oldTitle + "\" → \"" + newTitle + "\"");
        if (oldStatus != saved.getStatus())
            changes.add("Status: " + oldStatus + " → " + saved.getStatus());
        int newFieldCount = fieldCount(saved);
        if (oldFieldCount != newFieldCount)
            changes.add("Fields: " + oldFieldCount + " → " + newFieldCount);
        int newWebhookCount = saved.getWebhooks() != null ? saved.getWebhooks().size() : 0;
        if (oldWebhookCount != newWebhookCount)
            changes.add("Webhooks: " + oldWebhookCount + " → " + newWebhookCount);

        auditLogService.logByCurrentUser(AuditAction.FORM_UPDATED, saved.getId().toString(), saved.getSchema().getTitle(),
                changes.isEmpty() ? null : String.join("\n", changes));
        return saved;
    }

    /**
     * Replaces a form's access settings — access mode, per-user limit and
     * opening window (task #46).
     *
     * @param formId  the form's ID
     * @param request the new settings (full replacement)
     * @return the updated form
     * @throws IllegalArgumentException if the access mode isn't available yet
     *                                  or the window ends before it starts
     * @since v.0.1
     */
    @Transactional
    public Form updateSettings(UUID formId, FormSettingsRequest request) {
        Form form = getById(formId);
        applySettings(form, request);
        Form saved = formRepository.save(form);
        auditLogService.logByCurrentUser(AuditAction.FORM_UPDATED, saved.getId().toString(),
                saved.getSchema().getTitle(), "Access settings: " + request.accessMode());
        return saved;
    }

    private void applySettings(Form form, FormSettingsRequest request) {
        if (request.opensAt() != null && request.closesAt() != null && !request.closesAt().isAfter(request.opensAt())) {
            throw new IllegalArgumentException("The closing time must be after the opening time");
        }
        form.setAccessMode(request.accessMode());
        form.setSubmissionLimitPerUser(request.submissionLimitPerUser());
        form.setOpensAt(request.opensAt());
        form.setClosesAt(request.closesAt());
        applyRoleGate(form, request.allowedRoleIds(), request.deniedRoleIds());
    }

    /**
     * Replaces the RoleGate lists (E2.1) and checks them against the access
     * mode: a {@code ROLE_GATED} form needs at least one rule — otherwise it
     * would quietly behave like {@code AUTHENTICATED} — and a role can't be
     * both allowed and denied. Lists are kept in other modes, so switching
     * back to {@code ROLE_GATED} restores them.
     */
    private static void applyRoleGate(Form form, Set<String> allowed, Set<String> denied) {
        Set<Long> allowedIds = allowed != null ? parseIds(allowed) : Set.of();
        Set<Long> deniedIds = denied != null ? parseIds(denied) : Set.of();
        if (allowedIds.size() > MAX_ROLE_GATE_ROLES || deniedIds.size() > MAX_ROLE_GATE_ROLES) {
            throw new IllegalArgumentException("At most " + MAX_ROLE_GATE_ROLES + " roles per list");
        }
        if (allowedIds.stream().anyMatch(deniedIds::contains)) {
            throw new IllegalArgumentException("A role can't be both allowed and denied");
        }
        if (form.getAccessMode() == FormAccessMode.ROLE_GATED && allowedIds.isEmpty() && deniedIds.isEmpty()) {
            throw new IllegalArgumentException("Pick at least one allowed or denied role for a role-gated form");
        }
        form.getAllowedRoleIds().clear();
        form.getAllowedRoleIds().addAll(allowedIds);
        form.getDeniedRoleIds().clear();
        form.getDeniedRoleIds().addAll(deniedIds);
    }

    /**
     * Deletes a form by its ID.
     *
     * @param formId the UUID of the form to delete
     * @throws NotFoundException if the form does not exist
     * @since v.0.1
     */
    @Transactional
    public void delete(UUID formId) {
        Form form = formRepository.findById(formId)
                .orElseThrow(() -> new NotFoundException("Form not found: " + formId));
        String title = form.getSchema().getTitle();
        // A deleted form takes its submissions and files with it: nothing of
        // the respondents' data is left behind out of everyone's reach (#103).
        fileService.deleteForForm(formId);
        long removed = submissionRepository.deleteAllByFormId(formId);
        formReminderRepository.deleteAllByFormId(formId);
        formRepository.delete(form);
        if (form.getServerId() != null) {
            auditLogService.logGuildAction(form.getServerId(), AuditAction.FORM_DELETED, "FORM", formId.toString(),
                    title, java.util.Map.of("submissions", removed), null);
        } else {
            auditLogService.logByCurrentUser(AuditAction.FORM_DELETED, formId.toString(), title, null);
        }
    }

    // ── Lifecycle ───────────────────────────────────────────────────────────

    /**
     * Publishes a form (task #41): it gets a unique public slug (once — a
     * re-published form keeps its original link) and starts accepting
     * submissions.
     *
     * @param formId the form's ID
     * @return the published form
     * @throws InvalidStateException if the form is archived or has no input fields
     * @since v.0.1
     */
    @Transactional
    public Form publish(UUID formId) {
        Form form = getById(formId);
        requireNotArchived(form);
        requirePublishable(form);
        FormSchemaValidator.validate(form.getSchema());
        assignSlugIfMissing(form);
        FormStatus old = form.getStatus();
        form.setStatus(FormStatus.PUBLISHED);
        Form saved = formRepository.save(form);
        if (old != FormStatus.PUBLISHED) logStatusChange(saved, old);
        return saved;
    }

    /**
     * Moves a form to another status. {@code PUBLISHED} goes through
     * {@link #publish}; {@code DRAFT} is only possible for a form that has
     * never been published (a published link must not silently go back to
     * "under construction" — close it instead).
     *
     * @param formId the form's ID
     * @param target the target status
     * @return the updated form
     * @throws InvalidStateException if the transition isn't allowed
     * @since v.0.1
     */
    @Transactional
    public Form changeStatus(UUID formId, FormStatus target) {
        if (target == FormStatus.PUBLISHED) return publish(formId);
        Form form = getById(formId);
        if (target == FormStatus.DRAFT && form.getSlug() != null) {
            throw new InvalidStateException("A form that has been published can't go back to draft — close it instead");
        }
        FormStatus old = form.getStatus();
        if (old == target) return form;
        if (old == FormStatus.ARCHIVED) planLimitService.requireRoomFor(form.getServerId(), PlanMetric.ACTIVE_FORMS);
        form.setStatus(target);
        Form saved = formRepository.save(form);
        logStatusChange(saved, old);
        return saved;
    }

    private void logStatusChange(Form form, FormStatus old) {
        auditLogService.logByCurrentUser(AuditAction.FORM_UPDATED, form.getId().toString(),
                form.getSchema().getTitle(), "Status: " + old + " → " + form.getStatus());
    }

    // ── Fields (task #42) ───────────────────────────────────────────────────

    /**
     * Appends a field to a form. A blank {@code id} gets a generated one.
     *
     * @param formId the form's ID
     * @param field  the new field
     * @return the updated form
     * @throws me.marensovich.gta5rpformapp.backend.exception.FieldValidationException if the
     *         field's configuration is invalid or its id is already used
     * @since v.0.1
     */
    @Transactional
    public Form addField(UUID formId, FormField field) {
        Form form = getById(formId);
        if (field != null && (field.getId() == null || field.getId().isBlank())) {
            field.setId("f_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10));
        }
        List<FormField> fields = new ArrayList<>(fieldsOf(form));
        fields.add(field);
        return saveFields(form, fields, "Field added: " + (field != null ? field.getLabel() : null));
    }

    /**
     * Replaces a field's configuration; its id never changes.
     *
     * @param formId  the form's ID
     * @param fieldId the field's id
     * @param field   the new configuration
     * @return the updated form
     * @throws NotFoundException if the form has no such field
     * @since v.0.1
     */
    @Transactional
    public Form updateField(UUID formId, String fieldId, FormField field) {
        Form form = getById(formId);
        FormSchemaValidator.validateField(field);
        List<FormField> fields = new ArrayList<>(fieldsOf(form));
        int index = indexOf(fields, fieldId);
        field.setId(fieldId);
        fields.set(index, field);
        return saveFields(form, fields, "Field updated: " + field.getLabel());
    }

    /**
     * Removes a field. A published form must keep at least one input field.
     *
     * @param formId  the form's ID
     * @param fieldId the field's id
     * @return the updated form
     * @throws NotFoundException if the form has no such field
     * @since v.0.1
     */
    @Transactional
    public Form deleteField(UUID formId, String fieldId) {
        Form form = getById(formId);
        List<FormField> fields = new ArrayList<>(fieldsOf(form));
        FormField removed = fields.remove(indexOf(fields, fieldId));
        return saveFields(form, fields, "Field removed: " + removed.getLabel());
    }

    /**
     * Re-orders a form's fields in one write — all-or-nothing.
     *
     * @param formId   the form's ID
     * @param fieldIds every current field id, each once, in the new order
     * @return the updated form
     * @throws IllegalArgumentException if the ids aren't exactly the form's current fields
     * @since v.0.1
     */
    @Transactional
    public Form reorderFields(UUID formId, List<String> fieldIds) {
        Form form = getById(formId);
        List<FormField> current = fieldsOf(form);
        Set<String> currentIds = current.stream().map(FormField::getId).collect(Collectors.toSet());
        if (fieldIds.size() != current.size() || !new HashSet<>(fieldIds).equals(currentIds)) {
            throw new IllegalArgumentException("fieldIds must list every field of the form exactly once");
        }
        List<FormField> reordered = fieldIds.stream()
                .map(id -> current.get(indexOf(current, id)))
                .toList();
        return saveFields(form, new ArrayList<>(reordered), "Fields reordered");
    }

    private Form saveFields(Form form, List<FormField> fields, String auditDetail) {
        FormSchema schema = new FormSchema();
        schema.setTitle(form.getSchema().getTitle());
        schema.setDescription(form.getSchema().getDescription());
        schema.setFields(fields);
        FormSchemaValidator.validate(schema);
        form.setSchema(schema);
        if (form.getStatus() == FormStatus.PUBLISHED) requirePublishable(form);
        Form saved = formRepository.save(form);
        auditLogService.logByCurrentUser(AuditAction.FORM_UPDATED, saved.getId().toString(),
                schema.getTitle(), auditDetail);
        return saved;
    }

    // ── Webhooks ────────────────────────────────────────────────────────────

    /**
     * Marks one of a form's webhooks as invalid — Discord returned 404 for it
     * (see {@code WebhookDeliveryProcessor}), meaning it was deleted directly
     * on Discord's side. A no-op if the form or that webhook no longer exists
     * (e.g. it was removed from the form between the delivery attempt and
     * this call).
     *
     * @param formId     the form the webhook belongs to
     * @param webhookUrl identifies which webhook to mark
     * @param error      a short description, kept for later diagnosis
     * @since v.0.1
     */
    public void markWebhookInvalid(UUID formId, String webhookUrl, String error) {
        updateWebhookHealth(formId, webhookUrl, WebhookHealth.INVALID, WebhookHealth.REASON_WEBHOOK_DELETED, error);
    }

    /**
     * Records a webhook's notification status (E2.4, #74), from delivery
     * results or the background health check. Saves only on a change of
     * status or reason, so routine confirmations don't rewrite the form.
     * A no-op if the form or that webhook no longer exists.
     *
     * @param formId     the form the webhook belongs to
     * @param webhookUrl identifies which webhook
     * @param health     its new status
     * @param reason     a {@code WebhookHealth.REASON_*} code, {@code null} when healthy
     * @param error      a short description, kept for diagnosis, may be {@code null}
     * @since v.0.1
     */
    public void updateWebhookHealth(UUID formId, String webhookUrl, WebhookHealth health,
                                    String reason, String error) {
        // A background update must never overwrite an owner's concurrent save
        // (#103): on a version conflict, re-read and apply again.
        for (int attempt = 1; ; attempt++) {
            try {
                transactionTemplate.executeWithoutResult(status ->
                        applyWebhookHealth(formId, webhookUrl, health, reason, error));
                return;
            } catch (org.springframework.dao.OptimisticLockingFailureException e) {
                if (attempt == 3) throw e;
            }
        }
    }

    private void applyWebhookHealth(UUID formId, String webhookUrl, WebhookHealth health,
                                    String reason, String error) {
        formRepository.findById(formId).ifPresent(form -> {
            if (form.getWebhooks() == null) return;
            boolean changed = false;
            for (WebhookConfig webhook : form.getWebhooks()) {
                if (!webhookUrl.equals(webhook.getUrl())) continue;
                if (webhook.effectiveHealth() == health && java.util.Objects.equals(webhook.getHealthReason(), reason)) {
                    continue;
                }
                webhook.setHealth(health);
                webhook.setHealthReason(reason);
                webhook.setHealthCheckedAt(LocalDateTime.now().toString());
                webhook.setInvalid(health == WebhookHealth.INVALID ? Boolean.TRUE : null);
                if (error != null) webhook.setLastError(WebhookUrlCipher.redact(error));
                changed = true;
            }
            if (changed) formRepository.save(form);
        });
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private void assignSlugIfMissing(Form form) {
        if (form.getSlug() != null) return;
        for (int i = 0; i < SLUG_ATTEMPTS; i++) {
            String candidate = SlugGenerator.generate(form.getSchema().getTitle());
            if (!formRepository.existsBySlug(candidate)) {
                form.setSlug(candidate);
                return;
            }
        }
        throw new IllegalStateException("Could not generate a unique slug");
    }

    private static void requirePublishable(Form form) {
        boolean hasInput = fieldsOf(form).stream()
                .anyMatch(f -> f != null && f.getType() != null && f.getType().isInput());
        if (!hasInput) {
            throw new InvalidStateException("A published form needs at least one field to fill in");
        }
    }

    private static void requireNotArchived(Form form) {
        if (form.getStatus() == FormStatus.ARCHIVED) {
            throw new InvalidStateException("Archived forms can't be published — unarchive it first");
        }
    }

    private static List<FormField> fieldsOf(Form form) {
        return form.getSchema() == null || form.getSchema().getFields() == null
                ? List.of() : form.getSchema().getFields();
    }

    private static int fieldCount(Form form) {
        return fieldsOf(form).size();
    }

    private static int indexOf(List<FormField> fields, String fieldId) {
        for (int i = 0; i < fields.size(); i++) {
            if (fields.get(i) != null && fieldId.equals(fields.get(i).getId())) return i;
        }
        throw new NotFoundException("Field not found: " + fieldId);
    }

    /**
     * Validates webhooks coming from a client (security audit, #103): every
     * URL must be a Discord webhook and is stored in its canonical
     * {@code discord.com} form, so delivery can never be aimed at another
     * host. The system-managed status fields are never taken from the
     * client: they carry over from the same webhook as previously saved,
     * except {@code invalid}, which an owner's save clears (see
     * {@link WebhookConfig#getInvalid()}).
     */
    private static List<WebhookConfig> checkedWebhooks(List<WebhookConfig> incoming, List<WebhookConfig> previous) {
        Map<String, String> errors = new LinkedHashMap<>();
        List<WebhookConfig> result = new ArrayList<>();
        for (int i = 0; i < incoming.size(); i++) {
            WebhookConfig webhook = incoming.get(i);
            if (webhook == null) continue;
            if (webhook.getUrl() != null && !webhook.getUrl().isBlank()) {
                DiscordWebhookUrl parsed = DiscordWebhookUrl.parse(webhook.getUrl()).orElse(null);
                if (parsed == null) {
                    errors.put("webhooks[" + i + "].url", "Must be a Discord webhook URL: https://discord.com/api/webhooks/<id>/<token>");
                    continue;
                }
                webhook.setUrl(parsed.canonical());
            }
            WebhookConfig before = previous == null ? null : previous.stream()
                    .filter(w -> webhook.getUrl() != null && webhook.getUrl().equals(canonicalUrl(w.getUrl())))
                    .findFirst().orElse(null);
            boolean keep = before != null && !Boolean.TRUE.equals(before.getInvalid());
            webhook.setInvalid(null);
            webhook.setHealth(keep ? before.getHealth() : null);
            webhook.setHealthReason(keep ? before.getHealthReason() : null);
            webhook.setHealthCheckedAt(keep ? before.getHealthCheckedAt() : null);
            webhook.setLastError(keep ? before.getLastError() : null);
            result.add(webhook);
        }
        if (!errors.isEmpty()) throw new FieldValidationException("Invalid webhooks", errors);
        return result;
    }

    private static String canonicalUrl(String url) {
        return DiscordWebhookUrl.parse(url).map(DiscordWebhookUrl::canonical).orElse(url);
    }

    private static Set<Long> parseIds(Set<String> ids) {
        try {
            return ids.stream().map(Long::parseUnsignedLong).collect(Collectors.toSet());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Discord IDs must be numeric");
        }
    }
}
