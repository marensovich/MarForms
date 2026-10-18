package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditDiff;
import me.marensovich.gta5rpformapp.backend.data.settings.SystemSettings;
import me.marensovich.gta5rpformapp.backend.service.AuditLogService;
import me.marensovich.gta5rpformapp.backend.service.SettingsService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

import static me.marensovich.gta5rpformapp.backend.data.settings.SystemSettings.*;

/**
 * REST controller for system settings management.
 * <p>
 * Provides endpoints for retrieving and updating system configuration.
 * Public settings are available without authentication, while full settings
 * management requires the {@code SYSTEM_ADMIN} authority.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
public class SettingsController {

    /**
     * Total number of audit actions available in the system.
     * Used for displaying log filter statistics.
     */
    private static final int TOTAL_ACTIONS = AuditAction.values().length;

    private final SettingsService settingsService;
    private final AuditLogService auditLogService;

    /**
     * Retrieves public-facing settings.
     * <p>
     * These settings are available without authentication and are used
     * for displaying system information to all users.
     * </p>
     *
     * @return a {@link Map} containing public settings (ban message, admin contact, system name)
     * @since v.0.1
     */
    @GetMapping("/public")
    public Map<String, String> getPublicSettings() {
        SystemSettings s = settingsService.getSettings();
        Map<String, String> pub = new LinkedHashMap<>();
        pub.put("banMessage", s.banMessage());
        pub.put("banAdminContact", s.banAdminContact());
        pub.put("systemName", s.systemName());
        pub.put("uiLanguage", s.uiLanguage());
        return pub;
    }

    /**
     * Retrieves all system settings.
     * <p>
     * Requires the {@code SYSTEM_ADMIN} authority.
     * </p>
     *
     * @return a {@link SystemSettings} object containing all system configuration
     * @since v.0.1
     */
    @GetMapping
    @PreAuthorize("hasAuthority('SYSTEM_ADMIN')")
    public SystemSettings getAll() {
        return settingsService.getSettings();
    }

    /**
     * Updates system settings.
     * <p>
     * Only allows updating predefined keys. Provides audit logging of changes.
     * Requires the {@code SYSTEM_ADMIN} authority.
     * </p>
     *
     * @param updates a {@link Map} of key-value pairs to update
     * @return the updated {@link SystemSettings} object
     * @since v.0.1
     */
    @PutMapping
    @PreAuthorize("hasAuthority('SYSTEM_ADMIN')")
    public SystemSettings update(@RequestBody Map<String, String> updates) {
        SystemSettings before = settingsService.getSettings();

        Map<String, String> allowed = new LinkedHashMap<>();
        allowed.put(KEY_BAN_MESSAGE, updates.getOrDefault(KEY_BAN_MESSAGE, ""));
        allowed.put(KEY_BAN_ADMIN_CONTACT, updates.getOrDefault(KEY_BAN_ADMIN_CONTACT, ""));
        allowed.put(KEY_SYSTEM_NAME, updates.getOrDefault(KEY_SYSTEM_NAME, ""));
        allowed.put(KEY_SYSTEM_CONTACT, updates.getOrDefault(KEY_SYSTEM_CONTACT, ""));
        allowed.put(KEY_LOG_WEBHOOK_URL, updates.getOrDefault(KEY_LOG_WEBHOOK_URL, ""));
        allowed.put(KEY_LOG_ENABLED_ACTIONS, updates.getOrDefault(KEY_LOG_ENABLED_ACTIONS, ""));
        allowed.put(KEY_G_COLOR, updates.getOrDefault(KEY_G_COLOR, ""));
        allowed.put(KEY_G_TITLE, updates.getOrDefault(KEY_G_TITLE, ""));
        allowed.put(KEY_G_DESC, updates.getOrDefault(KEY_G_DESC, ""));
        allowed.put(KEY_G_AUTHOR_NAME, updates.getOrDefault(KEY_G_AUTHOR_NAME, ""));
        allowed.put(KEY_G_AUTHOR_ICON, updates.getOrDefault(KEY_G_AUTHOR_ICON, ""));
        allowed.put(KEY_G_AUTHOR_URL, updates.getOrDefault(KEY_G_AUTHOR_URL, ""));
        allowed.put(KEY_G_THUMBNAIL, updates.getOrDefault(KEY_G_THUMBNAIL, ""));
        allowed.put(KEY_G_IMAGE, updates.getOrDefault(KEY_G_IMAGE, ""));
        allowed.put(KEY_G_FOOTER_TEXT, updates.getOrDefault(KEY_G_FOOTER_TEXT, ""));
        allowed.put(KEY_G_FOOTER_ICON, updates.getOrDefault(KEY_G_FOOTER_ICON, ""));
        allowed.put(KEY_UI_LANGUAGE, updates.getOrDefault(KEY_UI_LANGUAGE, "en"));

        SystemSettings after = settingsService.updateSettings(allowed);
        auditLogService.logByCurrentUser(AuditAction.SETTINGS_UPDATED,
                null, "System Settings", buildSettingsDiff(before, after), new AuditDiff().deep("", AuditDiff.snapshot(before), after));
        return after;
    }

    /**
     * Builds a human-readable diff between two system settings states.
     * <p>
     * Used for audit logging to show exactly what changed.
     * </p>
     *
     * @param before the settings state before the update
     * @param after  the settings state after the update
     * @return a formatted string describing the changes
     * @since v.0.1
     */
    private String buildSettingsDiff(SystemSettings before, SystemSettings after) {
        List<String> lines = new ArrayList<>();

        diff(lines, "System Name", before.systemName(), after.systemName());
        diff(lines, "Contact", before.systemContact(), after.systemContact());
        diff(lines, "Ban Message", before.banMessage(), after.banMessage());
        diff(lines, "Admin Contact", before.banAdminContact(), after.banAdminContact());
        diff(lines, "Log Webhook", maskUrl(before.logWebhookUrl()), maskUrl(after.logWebhookUrl()));

        String bAct = before.logEnabledActions(), aAct = after.logEnabledActions();
        if (!Objects.equals(bAct, aAct))
            lines.add("Log Filters: " + describeActions(bAct) + " → " + describeActions(aAct));

        // Global embed — text fields individually
        diff(lines, "Embed Color", before.globalEmbedColor(), after.globalEmbedColor());
        diff(lines, "Embed Title", before.globalEmbedTitle(), after.globalEmbedTitle());
        diff(lines, "Embed Description", before.globalEmbedDescription(), after.globalEmbedDescription());
        diff(lines, "Embed Author", before.globalEmbedAuthorName(), after.globalEmbedAuthorName());
        diff(lines, "Embed Footer", before.globalEmbedFooterText(), after.globalEmbedFooterText());

        // URL/image fields — collapsed into one line to keep the diff concise
        boolean urlsChanged =
                !Objects.equals(before.globalEmbedAuthorIcon(), after.globalEmbedAuthorIcon()) ||
                        !Objects.equals(before.globalEmbedAuthorUrl(), after.globalEmbedAuthorUrl()) ||
                        !Objects.equals(before.globalEmbedThumbnail(), after.globalEmbedThumbnail()) ||
                        !Objects.equals(before.globalEmbedImage(), after.globalEmbedImage()) ||
                        !Objects.equals(before.globalEmbedFooterIcon(), after.globalEmbedFooterIcon());
        if (urlsChanged) lines.add("Embed URLs/Images: updated");

        return lines.isEmpty() ? "No changes" : String.join("\n", lines);
    }

    /**
     * Describes which audit actions are enabled.
     *
     * @param raw the raw string of enabled action IDs
     * @return a human-readable description of enabled actions
     * @since v.0.1
     */
    private String describeActions(String raw) {
        if (raw == null || raw.isBlank()) return "all " + TOTAL_ACTIONS + " enabled";
        long count = java.util.Arrays.stream(raw.split(",")).filter(s -> !s.isBlank()).count();
        return count + "/" + TOTAL_ACTIONS + " enabled";
    }

    /**
     * Adds a diff line to the output if the values differ.
     *
     * @param out    the list to append the diff to
     * @param label  the label describing the setting
     * @param before the old value
     * @param after  the new value
     * @since v.0.1
     */
    private void diff(List<String> out, String label, String before, String after) {
        if (!Objects.equals(before, after))
            out.add(label + ": \"" + before + "\" → \"" + after + "\"");
    }

    /**
     * Masks a URL for safe display in logs.
     *
     * @param url the URL to mask
     * @return a truncated version of the URL if it exceeds 40 characters
     * @since v.0.1
     */
    private String maskUrl(String url) {
        if (url == null || url.isBlank()) return "(not set)";
        return url.length() > 40 ? url.substring(0, 37) + "…" : url;
    }
}