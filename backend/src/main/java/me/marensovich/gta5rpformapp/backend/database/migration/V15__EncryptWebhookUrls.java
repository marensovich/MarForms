package me.marensovich.gta5rpformapp.backend.database.migration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import me.marensovich.gta5rpformapp.backend.service.discord.WebhookUrlCipher;
import me.marensovich.gta5rpformapp.backend.service.jobs.OutboundJobService;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Encrypts the webhook URLs already stored in plain text (#57): in
 * {@code form.webhooks}, the keys of {@code submission.webhook_message_ids}
 * and pending webhook deliveries in {@code outbound_jobs}. Error texts that
 * may quote a webhook URL are redacted.
 * <p>
 * A Java migration because it needs the application's encryption key; Spring
 * Boot hands {@code JavaMigration} beans to Flyway. It is idempotent: values
 * already sealed are left alone.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Component
public class V15__EncryptWebhookUrls extends BaseJavaMigration {

    private static final TypeReference<List<Map<String, Object>>> WEBHOOKS = new TypeReference<>() {
    };
    private static final TypeReference<Map<String, Object>> OBJECT = new TypeReference<>() {
    };

    private final WebhookUrlCipher cipher;
    private final ObjectMapper json = new ObjectMapper();

    public V15__EncryptWebhookUrls(WebhookUrlCipher cipher) {
        this.cipher = cipher;
    }

    @Override
    public void migrate(Context context) throws Exception {
        JdbcTemplate jdbc = new JdbcTemplate(new SingleConnectionDataSource(context.getConnection(), true));

        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT id, webhooks::text AS value FROM form WHERE webhooks IS NOT NULL")) {
            List<Map<String, Object>> webhooks = json.readValue((String) row.get("value"), WEBHOOKS);
            if (webhooks == null) continue;
            for (Map<String, Object> webhook : webhooks) {
                if (webhook.get("url") instanceof String url && !WebhookUrlCipher.isSealed(url)) {
                    webhook.put("url", cipher.seal(url));
                }
                if (webhook.get("lastError") instanceof String error) {
                    webhook.put("lastError", WebhookUrlCipher.redact(error));
                }
            }
            update(jdbc, "form", "webhooks", row.get("id"), webhooks);
        }

        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT id, webhook_message_ids::text AS value FROM submission WHERE webhook_message_ids IS NOT NULL")) {
            Map<String, Object> ids = json.readValue((String) row.get("value"), OBJECT);
            if (ids == null || ids.keySet().stream().allMatch(WebhookUrlCipher::isSealed)) continue;
            Map<String, Object> sealed = new LinkedHashMap<>();
            ids.forEach((url, messageId) -> sealed.put(WebhookUrlCipher.isSealed(url) ? url : cipher.seal(url), messageId));
            update(jdbc, "submission", "webhook_message_ids", row.get("id"), sealed);
        }

        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT id, payload::text AS value FROM outbound_jobs WHERE job_type = ?",
                OutboundJobService.JOB_TYPE_WEBHOOK_DELIVERY)) {
            Map<String, Object> payload = json.readValue((String) row.get("value"), OBJECT);
            if (payload.get("webhookUrl") instanceof String url && !WebhookUrlCipher.isSealed(url)) {
                payload.put("webhookUrl", cipher.seal(url));
                update(jdbc, "outbound_jobs", "payload", row.get("id"), payload);
            }
        }
        for (Map<String, Object> row : jdbc.queryForList(
                "SELECT id, last_error FROM outbound_jobs WHERE last_error LIKE '%webhooks/%'")) {
            jdbc.update("UPDATE outbound_jobs SET last_error = ? WHERE id = ?",
                    WebhookUrlCipher.redact((String) row.get("last_error")), row.get("id"));
        }
    }

    private void update(JdbcTemplate jdbc, String table, String column, Object id, Object value)
            throws JsonProcessingException {
        jdbc.update("UPDATE " + table + " SET " + column + " = ?::jsonb WHERE id = ?",
                json.writeValueAsString(value), (UUID) id);
    }
}
