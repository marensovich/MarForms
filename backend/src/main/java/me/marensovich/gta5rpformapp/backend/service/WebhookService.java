package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.data.settings.SystemSettings;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Sends Discord webhook notifications for form submissions and deletes them on removal.
 * <p>
 * Delivery itself is queued and async — see {@code OutboundJobService} and
 * {@code WebhookDeliveryProcessor} — this class only knows how to build and
 * send/delete one message at a time; it has no opinion on retry or scheduling.
 * </p>
 * <p>
 * Each submission produces a message with <b>two embeds</b>:
 * <ol>
 *   <li>The form-answers embed — configured per-webhook on the form.</li>
 *   <li>The global branding embed — configured in the admin panel settings
 *       ({@code global.embed.*} keys). Omitted when no branding fields are set.</li>
 * </ol>
 * Both embeds support template variables (see {@link #buildVars}).
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WebhookService {

    private static final int DEFAULT_COLOR = 5793266;

    /**
     * Matches {@code https://discord.com/api/webhooks/{id}/{token}}
     */
    private static final Pattern WEBHOOK_URL_PATTERN =
            Pattern.compile("https://discord\\.com/api/webhooks/(\\d+)/([^/?]+)");

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm:ss");

    private final SettingsService settingsService;
    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Delivers a submission notification to a single webhook.
     * <p>
     * Called by {@code WebhookDeliveryProcessor} for each queued delivery job
     * (see {@code OutboundJobService#JOB_TYPE_WEBHOOK_DELIVERY}) — one job per
     * webhook per submission, so one webhook's failure/retry never blocks or
     * duplicates delivery to the form's other webhooks. Posts with
     * {@code ?wait=true} to capture the Discord message ID for later deletion.
     * </p>
     * <p>
     * Throws whatever the underlying HTTP call throws (notably
     * {@code HttpClientErrorException.TooManyRequests} / {@code .NotFound}) —
     * the processor is what decides retry/give-up/invalidate based on that,
     * not this method.
     * </p>
     *
     * @param form            the submitted form
     * @param webhook         which of the form's webhooks to deliver to
     * @param answers         raw answer map
     * @param discordUsername username of the submitter (may be null)
     * @param discordId       Discord snowflake of the submitter (may be null)
     * @param submissionId    UUID of the submission being notified about
     * @return the Discord message ID, or {@code null} if Discord's response didn't include one
     * @since v.0.1
     */
    public String deliverToWebhook(Form form, WebhookConfig webhook, Map<String, Object> answers,
                                    String discordUsername, Long discordId, UUID submissionId) {
        Map<String, String> vars = buildVars(form, discordId, discordUsername, submissionId);
        return dispatch(form, answers, discordUsername, webhook, vars);
    }

    /**
     * Deletes Discord messages that were created by previous webhook deliveries.
     * Failures are logged but do not propagate.
     *
     * @param webhookMessageIds map of webhook URL → Discord message ID (stored on the submission)
     * @since v.0.1
     */
    public void deleteMessages(Map<String, String> webhookMessageIds) {
        if (webhookMessageIds == null || webhookMessageIds.isEmpty()) return;

        for (Map.Entry<String, String> entry : webhookMessageIds.entrySet()) {
            String webhookUrl = entry.getKey();
            String messageId = entry.getValue();

            Matcher matcher = WEBHOOK_URL_PATTERN.matcher(webhookUrl);
            if (!matcher.find()) {
                log.warn("Cannot parse webhook URL for deletion: {}", webhookUrl);
                continue;
            }

            String deleteUrl = "https://discord.com/api/webhooks/"
                    + matcher.group(1) + "/" + matcher.group(2)
                    + "/messages/" + messageId;
            try {
                restTemplate.delete(deleteUrl);
                log.debug("Deleted Discord message {} from webhook {}", messageId, webhookUrl);
            } catch (Exception e) {
                log.warn("Failed to delete Discord message {} [{}]: {}", messageId, webhookUrl, e.getMessage());
            }
        }
    }

    @SuppressWarnings("unchecked")
    private String dispatch(Form form, Map<String, Object> answers,
                            String discordUsername, WebhookConfig cfg,
                            Map<String, String> vars) {
        Map<String, Object> payload = new LinkedHashMap<>();
        if (hasText(cfg.getContent())) payload.put("content", sub(cfg.getContent(), vars));
        if (hasText(cfg.getBotName())) payload.put("username", cfg.getBotName());
        if (hasText(cfg.getAvatarUrl())) payload.put("avatar_url", cfg.getAvatarUrl());

        List<Map<String, Object>> embeds = new ArrayList<>();
        embeds.add(buildFormEmbed(form, answers, discordUsername, cfg, vars));
        Map<String, Object> globalEmbed = buildGlobalEmbed(vars);
        if (globalEmbed != null) embeds.add(globalEmbed);
        payload.put("embeds", embeds);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        String url = cfg.getUrl() + (cfg.getUrl().contains("?") ? "&wait=true" : "?wait=true");
        ResponseEntity<Map> response = restTemplate.postForEntity(
                url, new HttpEntity<>(payload, headers), Map.class);

        if (response.getBody() != null && response.getBody().get("id") != null) {
            return String.valueOf(response.getBody().get("id"));
        }
        return null;
    }

    /**
     * Builds the per-webhook form-answers embed (first embed).
     *
     * @param form            the submitted form
     * @param answers         raw answer map
     * @param discordUsername username of the submitter
     * @param cfg             webhook configuration
     * @param vars            variable substitution map
     * @return a {@link Map} representing the Discord embed
     * @since v.0.1
     */
    private Map<String, Object> buildFormEmbed(Form form, Map<String, Object> answers,
                                               String discordUsername, WebhookConfig cfg,
                                               Map<String, String> vars) {
        Map<String, Object> embed = new LinkedHashMap<>();

        embed.put("title", hasText(cfg.getEmbedTitle())
                ? sub(cfg.getEmbedTitle(), vars) : form.getSchema().getTitle());

        if (hasText(cfg.getEmbedDescription()))
            embed.put("description", sub(cfg.getEmbedDescription(), vars));

        embed.put("color", cfg.getColor() != null ? cfg.getColor() : DEFAULT_COLOR);

        Map<String, String> author = new LinkedHashMap<>();
        author.put("name", hasText(cfg.getAuthorName())
                ? sub(cfg.getAuthorName(), vars)
                : "Submitted by " + (discordUsername != null ? discordUsername : "Unknown"));
        if (hasText(cfg.getAuthorIconUrl())) author.put("icon_url", cfg.getAuthorIconUrl());
        if (hasText(cfg.getAuthorUrl())) author.put("url", cfg.getAuthorUrl());
        embed.put("author", author);

        if (hasText(cfg.getThumbnailUrl()))
            embed.put("thumbnail", Map.of("url", cfg.getThumbnailUrl()));

        boolean inline = Boolean.TRUE.equals(cfg.getFieldsInline());
        List<Map<String, Object>> fields = new ArrayList<>();
        for (var field : form.getSchema().getFields()) {
            Object raw = answers.get(field.getId());
            if (raw == null) continue;
            String value = formatValue(raw);
            if (value.isBlank()) continue;

            Map<String, Object> f = new LinkedHashMap<>();
            f.put("name", field.getLabel());
            f.put("value", value.length() > 1024 ? value.substring(0, 1021) + "…" : value);
            f.put("inline", inline);
            fields.add(f);
        }
        embed.put("fields", fields);

        if (hasText(cfg.getImageUrl()))
            embed.put("image", Map.of("url", cfg.getImageUrl()));

        embed.put("timestamp", java.time.OffsetDateTime.now().toString());

        return embed;
    }

    /**
     * Builds the global branding embed (second embed) from panel settings.
     * Returns {@code null} when no branding fields are configured — in that case the
     * second embed is omitted entirely from the Discord message.
     *
     * @param vars variable substitution map
     * @return a {@link Map} representing the global embed, or {@code null} if no fields are set
     * @since v.0.1
     */
    private Map<String, Object> buildGlobalEmbed(Map<String, String> vars) {
        String title = sub(settingsService.get(SystemSettings.KEY_G_TITLE, null), vars);
        String desc = sub(settingsService.get(SystemSettings.KEY_G_DESC, null), vars);
        String authorName = sub(settingsService.get(SystemSettings.KEY_G_AUTHOR_NAME, null), vars);
        String authorIcon = settingsService.get(SystemSettings.KEY_G_AUTHOR_ICON, null);
        String authorUrl = settingsService.get(SystemSettings.KEY_G_AUTHOR_URL, null);
        String thumbnail = settingsService.get(SystemSettings.KEY_G_THUMBNAIL, null);
        String image = settingsService.get(SystemSettings.KEY_G_IMAGE, null);
        String footerText = sub(settingsService.get(SystemSettings.KEY_G_FOOTER_TEXT, null), vars);
        String footerIcon = settingsService.get(SystemSettings.KEY_G_FOOTER_ICON, null);
        String colorStr = settingsService.get(SystemSettings.KEY_G_COLOR, null);

        if (!hasText(title) && !hasText(desc) && !hasText(authorName)
                && !hasText(footerText) && !hasText(thumbnail) && !hasText(image)) {
            return null;
        }

        Map<String, Object> embed = new LinkedHashMap<>();
        if (hasText(title)) embed.put("title", title);
        if (hasText(desc)) embed.put("description", desc);

        if (hasText(colorStr)) {
            try {
                int color = colorStr.startsWith("#")
                        ? Integer.parseInt(colorStr.substring(1), 16)
                        : Integer.parseInt(colorStr);
                embed.put("color", color);
            } catch (NumberFormatException ignored) {
            }
        }

        if (hasText(authorName)) {
            Map<String, String> author = new LinkedHashMap<>();
            author.put("name", authorName);
            if (hasText(authorIcon)) author.put("icon_url", authorIcon);
            if (hasText(authorUrl)) author.put("url", authorUrl);
            embed.put("author", author);
        }

        if (hasText(thumbnail)) embed.put("thumbnail", Map.of("url", thumbnail));

        if (hasText(footerText)) {
            Map<String, String> footer = new LinkedHashMap<>();
            footer.put("text", footerText);
            if (hasText(footerIcon)) footer.put("icon_url", footerIcon);
            embed.put("footer", footer);
        }

        if (hasText(image)) embed.put("image", Map.of("url", image));

        embed.put("timestamp", java.time.OffsetDateTime.now().toString());

        return embed;
    }

    /**
     * Builds the variable substitution map for a single submission.
     * Available variables:
     * <ul>
     *   <li>{username} — Discord username of the submitter</li>
     *   <li>{user_id} — Discord snowflake ID</li>
     *   <li>{user_mention} — {@code <@ID>} mention tag</li>
     *   <li>{form_title} — title of the form</li>
     *   <li>{form_id} — UUID of the form</li>
     *   <li>{submission_id} — UUID of the submission</li>
     *   <li>{timestamp} — Discord timestamp ({@code <t:unix:f>})</li>
     *   <li>{date} — server date (yyyy-MM-dd)</li>
     *   <li>{time} — server time (HH:mm:ss)</li>
     *   <li>{server_id} — Discord guild / server ID</li>
     * </ul>
     *
     * @param form            the submitted form
     * @param discordId       Discord ID of the submitter
     * @param discordUsername username of the submitter
     * @param submissionId    UUID of the submission
     * @return a {@link Map} of variable names to their values
     * @since v.0.1
     */
    private Map<String, String> buildVars(Form form, Long discordId, String discordUsername,
                                          UUID submissionId) {
        LocalDateTime now = LocalDateTime.now();
        long epoch = now.toEpochSecond(ZoneOffset.UTC);
        String uid = discordId != null ? discordId.toString() : "unknown";

        return Map.of(
                "username", discordUsername != null ? discordUsername : "Unknown",
                "user_id", uid,
                "user_mention", discordId != null ? "<@" + discordId + ">" : "Unknown",
                "form_title", form.getSchema().getTitle(),
                "form_id", form.getId().toString(),
                "submission_id", submissionId != null ? submissionId.toString() : "",
                "timestamp", "<t:" + epoch + ":f>",
                "date", now.format(DATE_FMT),
                "time", now.format(TIME_FMT),
                "server_id", form.getServerId() != null ? form.getServerId().toString() : ""
        );
    }

    /**
     * Replaces all {@code {var}} placeholders in {@code template} using the vars map.
     *
     * @param template the template string containing placeholders
     * @param vars     the variable substitution map
     * @return the substituted string
     * @since v.0.1
     */
    private String substitute(String template, Map<String, String> vars) {
        String result = template;
        for (Map.Entry<String, String> e : vars.entrySet()) {
            result = result.replace("{" + e.getKey() + "}", e.getValue());
        }
        return result;
    }

    /**
     * Null-safe substitute: returns null if template is null/blank, otherwise substitutes.
     *
     * @param template the template string
     * @param vars     the variable substitution map
     * @return the substituted string, or {@code null} if template is blank
     * @since v.0.1
     */
    private String sub(String template, Map<String, String> vars) {
        if (template == null || template.isBlank()) return null;
        return substitute(template, vars);
    }

    /**
     * Formats a field value for display in a Discord embed.
     *
     * @param value the raw value to format
     * @return a formatted string representation
     * @since v.0.1
     */
    private String formatValue(Object value) {
        if (value instanceof List<?> list) {
            return list.stream().map(Object::toString).collect(Collectors.joining(", "));
        }
        if (value instanceof Boolean b) {
            return b ? "✅ Yes" : "❌ No";
        }
        return value.toString();
    }

    /**
     * Utility method to check if a string is not null and not blank.
     *
     * @param s the string to check
     * @return {@code true} if the string has content, {@code false} otherwise
     * @since v.0.1
     */
    private boolean hasText(String s) {
        return s != null && !s.isBlank();
    }
}