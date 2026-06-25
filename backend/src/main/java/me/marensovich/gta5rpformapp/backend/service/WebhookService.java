package me.marensovich.gta5rpformapp.backend.service;

import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Service for sending Discord webhook notifications for form submissions
 * and deleting those messages when a submission is removed.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Service
public class WebhookService {

    private static final int DEFAULT_COLOR = 5793266;

    /** Matches {@code https://discord.com/api/webhooks/{id}/{token}} */
    private static final Pattern WEBHOOK_URL_PATTERN =
            Pattern.compile("https://discord\\.com/api/webhooks/(\\d+)/([^/?]+)");

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Sends a notification to every configured webhook for a form submission.
     * <p>
     * Posts with {@code ?wait=true} so Discord returns the created message object,
     * allowing the returned message IDs to be stored for later deletion.
     * </p>
     *
     * @param form            the form that was submitted
     * @param answers         the submitted answers
     * @param discordUsername the Discord username of the submitter (may be null)
     * @return map of webhook URL → Discord message ID for every successfully delivered webhook
     * @since v.0.1
     */
    public Map<String, String> sendSubmissionNotifications(Form form, Map<String, Object> answers,
                                                           String discordUsername) {
        Map<String, String> messageIds = new LinkedHashMap<>();
        if (form.getWebhooks() == null || form.getWebhooks().isEmpty()) return messageIds;

        for (WebhookConfig webhook : form.getWebhooks()) {
            if (webhook.getUrl() == null || webhook.getUrl().isBlank()) continue;
            try {
                String messageId = dispatch(form, answers, discordUsername, webhook);
                if (messageId != null) {
                    messageIds.put(webhook.getUrl(), messageId);
                }
            } catch (Exception e) {
                log.warn("Webhook delivery failed [{}]: {}", webhook.getUrl(), e.getMessage());
            }
        }
        return messageIds;
    }

    /**
     * Deletes Discord messages that were created by previous webhook deliveries.
     * <p>
     * Calls {@code DELETE /webhooks/{id}/{token}/messages/{message_id}} for each entry.
     * Failures are logged but do not propagate — a missing Discord message must not
     * block the submission from being deleted in the database.
     * </p>
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

    /**
     * POSTs a single webhook payload to Discord with {@code ?wait=true} and returns
     * the Discord message ID from the response body.
     *
     * @return the Discord message ID, or {@code null} if the response contained no id
     */
    @SuppressWarnings("unchecked")
    private String dispatch(Form form, Map<String, Object> answers,
                            String discordUsername, WebhookConfig cfg) {
        Map<String, Object> payload = new LinkedHashMap<>();
        if (hasText(cfg.getContent())) payload.put("content", cfg.getContent());
        if (hasText(cfg.getBotName())) payload.put("username", cfg.getBotName());
        if (hasText(cfg.getAvatarUrl())) payload.put("avatar_url", cfg.getAvatarUrl());
        payload.put("embeds", List.of(buildEmbed(form, answers, discordUsername, cfg)));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        // ?wait=true makes Discord return the full message object with id field
        String url = cfg.getUrl() + (cfg.getUrl().contains("?") ? "&wait=true" : "?wait=true");
        ResponseEntity<Map> response = restTemplate.postForEntity(
                url, new HttpEntity<>(payload, headers), Map.class);

        if (response.getBody() != null && response.getBody().get("id") != null) {
            return String.valueOf(response.getBody().get("id"));
        }
        return null;
    }

    /**
     * Builds a Discord embed from the form submission data.
     * <p>
     * Creates an embed with:
     * <ul>
     *     <li>Title from the form schema or webhook config</li>
     *     <li>Description from webhook config</li>
     *     <li>Color from webhook config or default</li>
     *     <li>Author with submitter's username</li>
     *     <li>Fields for each form question/answer</li>
     *     <li>Timestamp of the submission</li>
     *     <li>Footer with "MarForms" branding</li>
     * </ul>
     * </p>
     *
     * @param form            the form that was submitted
     * @param answers         the submitted answers
     * @param discordUsername the Discord username of the submitter
     * @param cfg             the webhook configuration
     * @return a {@link Map} representing the Discord embed
     * @since v.0.1
     */
    private Map<String, Object> buildEmbed(Form form, Map<String, Object> answers,
                                           String discordUsername, WebhookConfig cfg) {
        Map<String, Object> embed = new LinkedHashMap<>();
        embed.put("title", hasText(cfg.getEmbedTitle()) ? cfg.getEmbedTitle() : form.getSchema().getTitle());
        if (hasText(cfg.getEmbedDescription())) embed.put("description", cfg.getEmbedDescription());
        embed.put("color", cfg.getColor() != null ? cfg.getColor() : DEFAULT_COLOR);
        embed.put("timestamp", OffsetDateTime.now().toString());

        Map<String, String> author = new LinkedHashMap<>();
        author.put("name", "Submitted by " + (discordUsername != null ? discordUsername : "Unknown"));
        embed.put("author", author);

        List<Map<String, Object>> fields = new ArrayList<>();
        for (var field : form.getSchema().getFields()) {
            Object raw = answers.get(field.getId());
            if (raw == null) continue;
            String value = formatValue(raw);
            if (value.isBlank()) continue;

            Map<String, Object> f = new LinkedHashMap<>();
            f.put("name", field.getLabel());
            f.put("value", value.length() > 1024 ? value.substring(0, 1021) + "…" : value);
            f.put("inline", false);
            fields.add(f);
        }
        embed.put("fields", fields);

        Map<String, String> footer = new LinkedHashMap<>();
        footer.put("text", "MarForms");
        embed.put("footer", footer);

        return embed;
    }

    /**
     * Formats a field value for display in a Discord embed.
     * <p>
     * Supports:
     * <ul>
     *     <li><b>List</b> — values are joined with commas</li>
     *     <li><b>Boolean</b> — displayed as "✅ Yes" or "❌ No"</li>
     *     <li><b>Other</b> — converted to string</li>
     * </ul>
     * </p>
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
