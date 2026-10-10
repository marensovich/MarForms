package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookHealth;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordWebhookLookup;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Background check of every form's webhooks (E2.4, #73): the per-channel
 * extension of {@link GuildStatusReconciler}'s connected/kicked check.
 * <p>
 * For each webhook: does it still exist on Discord ({@code INVALID} if
 * not), and can the bot still see its channel and manage webhooks there
 * ({@code DEGRADED} if not, even though the bot is still on the server)?
 * Results go through {@link FormService#updateWebhookHealth}, the same path
 * delivery uses, so the owner sees one status. Collecting submissions never
 * depends on any of this.
 * </p>
 * <p>
 * A {@code DEGRADED} status set by failing deliveries is left for delivery
 * to clear: a webhook can pass this check and still be failing to deliver.
 * Like the reconciler, the check is skipped where no bot runs (tests,
 * local setups without a bot token).
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebhookHealthChecker {

    private static final long CHECK_INTERVAL_MS = 30 * 60 * 1000L;

    private final FormRepository formRepository;
    private final FormService formService;
    private final DiscordBotClient discordBotClient;
    private final DiscordWebhookLookup webhookLookup;

    /**
     * Checks every webhook of every non-archived form.
     *
     * @since v.0.1
     */
    @Scheduled(fixedDelay = CHECK_INTERVAL_MS, initialDelay = 2 * 60 * 1000L)
    public void checkAll() {
        if (!discordBotClient.isAvailable()) return;
        for (Form form : formRepository.findAllByStatusNot(FormStatus.ARCHIVED)) {
            List<WebhookConfig> webhooks = form.getWebhooks();
            if (webhooks == null) continue;
            for (WebhookConfig webhook : List.copyOf(webhooks)) {
                if (webhook.getUrl() == null || webhook.getUrl().isBlank()) continue;
                try {
                    check(form, webhook);
                } catch (Exception e) {
                    log.warn("Health check of a webhook of form {} failed: {}", form.getId(), e.getMessage());
                }
            }
        }
    }

    /**
     * Checks one webhook and records the outcome.
     *
     * @param form    the form it belongs to
     * @param webhook the webhook
     * @since v.0.1
     */
    void check(Form form, WebhookConfig webhook) {
        DiscordWebhookLookup.Result found = webhookLookup.lookup(webhook.getUrl());
        switch (found.state()) {
            case GONE -> {
                record(form, webhook, WebhookHealth.INVALID, WebhookHealth.REASON_WEBHOOK_DELETED,
                        "The webhook no longer exists on Discord (deleted, or its token was reset)");
                return;
            }
            case NOT_A_DISCORD_WEBHOOK, UNKNOWN -> {
                return;
            }
            case FOUND -> {
            }
        }
        if (found.channelId() == null) return;

        Long guildId = found.guildId() != null ? found.guildId() : form.getServerId();
        switch (discordBotClient.checkChannelAccess(guildId, found.channelId())) {
            case OK -> {
                if (!WebhookHealth.REASON_DELIVERY_FAILING.equals(webhook.getHealthReason())) {
                    record(form, webhook, WebhookHealth.HEALTHY, null, null);
                }
            }
            case NOT_IN_GUILD -> record(form, webhook, WebhookHealth.DEGRADED, WebhookHealth.REASON_BOT_NOT_IN_GUILD,
                    "The bot is no longer on the webhook's server");
            case CHANNEL_UNAVAILABLE -> record(form, webhook, WebhookHealth.DEGRADED,
                    WebhookHealth.REASON_CHANNEL_UNAVAILABLE, "The bot can no longer see the webhook's channel");
            case MISSING_PERMISSIONS -> record(form, webhook, WebhookHealth.DEGRADED,
                    WebhookHealth.REASON_MISSING_PERMISSIONS, "The bot lost Manage Webhooks on the webhook's channel");
            case UNKNOWN -> {
            }
        }
    }

    private void record(Form form, WebhookConfig webhook, WebhookHealth health, String reason, String error) {
        if (webhook.effectiveHealth() == health && java.util.Objects.equals(webhook.getHealthReason(), reason)) return;
        log.info("Webhook of form {} is now {} ({})", form.getId(), health, reason);
        formService.updateWebhookHealth(form.getId(), webhook.getUrl(), health, reason, error);
    }
}
