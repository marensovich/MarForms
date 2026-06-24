package me.marensovich.gta5rpformapp.backend.service;

import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service for sending Discord webhook notifications for form submissions.
 * <p>
 * Handles the asynchronous delivery of submission data to configured Discord
 * webhooks. Supports custom embeds, bot names, avatars, and field formatting.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Service
public class WebhookService {

    /**
     * Default color for Discord embeds (blue-green).
     * Used when no color is specified in the webhook configuration.
     */
    private static final int DEFAULT_COLOR = 5793266;

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Sends notifications to all configured webhooks for a form submission.
     * <p>
     * Executed asynchronously to avoid blocking the main submission flow.
     * Each webhook is dispatched independently; failures in one webhook
     * do not affect others.
     * </p>
     *
     * @param form            the form that was submitted
     * @param answers         the submitted answers
     * @param discordUsername the Discord username of the submitter (may be null)
     * @since v.0.1
     */
    @Async
    public void sendSubmissionNotifications(Form form, Map<String, Object> answers, String discordUsername) {
        if (form.getWebhooks() == null || form.getWebhooks().isEmpty()) return;

        for (WebhookConfig webhook : form.getWebhooks()) {
            if (webhook.getUrl() == null || webhook.getUrl().isBlank()) continue;
            try {
                dispatch(form, answers, discordUsername, webhook);
            } catch (Exception e) {
                log.warn("Webhook delivery failed [{}]: {}", webhook.getUrl(), e.getMessage());
            }
        }
    }

    /**
     * Dispatches a single webhook payload to Discord.
     * <p>
     * Builds the full Discord webhook payload including the embed,
     * and sends it as a JSON POST request.
     * </p>
     *
     * @param form            the form that was submitted
     * @param answers         the submitted answers
     * @param discordUsername the Discord username of the submitter
     * @param cfg             the webhook configuration
     * @since v.0.1
     */
    private void dispatch(Form form, Map<String, Object> answers, String discordUsername, WebhookConfig cfg) {
        Map<String, Object> payload = new LinkedHashMap<>();

        if (hasText(cfg.getContent())) payload.put("content", cfg.getContent());
        if (hasText(cfg.getBotName())) payload.put("username", cfg.getBotName());
        if (hasText(cfg.getAvatarUrl())) payload.put("avatar_url", cfg.getAvatarUrl());

        payload.put("embeds", List.of(buildEmbed(form, answers, discordUsername, cfg)));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        restTemplate.postForEntity(cfg.getUrl(), new HttpEntity<>(payload, headers), String.class);
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

        // Author — who submitted
        Map<String, String> author = new LinkedHashMap<>();
        author.put("name", "Submitted by " + (discordUsername != null ? discordUsername : "Unknown"));
        embed.put("author", author);

        // Fields — one per form question
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

        // Footer
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