package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.database.entity.AuditLog;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordWebhookUrl;
import me.marensovich.gta5rpformapp.backend.service.discord.WebhookUrlCipher;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * A server's own log channels (2026-10-19): #ответы gets new responses and
 * decisions on them, #аудит the rest of the server's journal. Messages go out
 * after the action's transaction commits, off the request thread; a channel
 * whose webhook Discord no longer knows is forgotten, so the owner can
 * create the channels again.
 *
 * @author marensovich
 * @since v.0.1
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GuildLogService {

    /** Which of the server's log channels. */
    public enum Channel {RESPONSES, AUDIT}

    /** A message waiting for its transaction to commit. */
    public record Post(Long guildId, Channel channel, Map<String, Object> embed) {
    }

    /** Journal entries that are about responses, not the server's setup. */
    private static final Set<AuditAction> RESPONSE_ACTIONS = Set.of(AuditAction.SUBMISSION_CREATED,
            AuditAction.SUBMISSION_DECIDED, AuditAction.SUBMISSION_DELETED, AuditAction.SUBMISSION_DM_FAILED);

    private final GuildRepository guildRepository;
    private final WebhookUrlCipher webhookUrlCipher;
    private final RestTemplate restTemplate;
    private final ApplicationEventPublisher events;

    @org.springframework.beans.factory.annotation.Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    /**
     * Queues a message for one of a server's log channels.
     *
     * @param guildId the Discord guild snowflake ID; {@code null} sends nothing
     * @param channel which channel
     * @param embed   the Discord embed
     * @since v.0.1
     */
    public void post(Long guildId, Channel channel, Map<String, Object> embed) {
        if (guildId != null) events.publishEvent(new Post(guildId, channel, embed));
    }

    /**
     * A new response in #ответы. Its journal entry is the platform's, so it
     * isn't mirrored from there.
     *
     * @param guildId   the form's server
     * @param formTitle the form's title
     * @param number    the response's short number, may be {@code null}
     * @param authorId  who answered, may be {@code null}
     * @param path      the response's card in the panel, relative to the site
     * @since v.0.1
     */
    public void newResponse(Long guildId, String formTitle, Long number, Long authorId, String path) {
        Map<String, Object> embed = new LinkedHashMap<>();
        embed.put("title", number != null ? "Новый ответ #" + number : "Новый ответ");
        embed.put("description", "Форма «" + formTitle + "»");
        embed.put("color", 0x57F287);
        embed.put("url", frontendUrl + path);
        embed.put("timestamp", java.time.OffsetDateTime.now().toString());
        if (authorId != null) embed.put("fields", List.of(field("Автор", "<@" + authorId + ">", true)));
        post(guildId, Channel.RESPONSES, embed);
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPost(Post post) {
        deliver(post.guildId(), post.channel(), post.embed());
    }

    /**
     * Mirrors a server's journal entry into its log channels. Called by
     * {@link AuditLogDispatcher} after the entry's transaction committed.
     *
     * @param entry the entry; platform entries (no server) are skipped
     * @since v.0.1
     */
    void dispatch(AuditLog entry) {
        if (entry.getGuildId() == null) return;
        deliver(entry.getGuildId(), RESPONSE_ACTIONS.contains(entry.getAction()) ? Channel.RESPONSES : Channel.AUDIT,
                auditEmbed(entry));
    }

    /**
     * Posts one embed to a webhook right away — the greeting of a channel
     * just connected. A failure is logged, never thrown.
     *
     * @param url   the webhook's URL, as Discord gave it
     * @param embed the embed
     * @return whether Discord took it
     * @since v.0.1
     */
    public boolean sendNow(String url, Map<String, Object> embed) {
        DiscordWebhookUrl webhook = DiscordWebhookUrl.parse(url).orElse(null);
        if (webhook == null) return false;
        try {
            send(webhook, embed);
            return true;
        } catch (Exception e) {
            log.warn("Webhook {} refused a message: {}", webhook, WebhookUrlCipher.redact(e.getMessage()));
            return false;
        }
    }

    private void deliver(Long guildId, Channel channel, Map<String, Object> embed) {
        Guild guild = guildRepository.findById(guildId).orElse(null);
        if (guild == null) return;
        String sealed = channel == Channel.RESPONSES ? guild.getLogResponsesWebhook() : guild.getLogAuditWebhook();
        if (sealed == null) return;
        DiscordWebhookUrl webhook = DiscordWebhookUrl.parse(webhookUrlCipher.open(sealed)).orElse(null);
        if (webhook == null) return;
        try {
            send(webhook, embed);
        } catch (HttpClientErrorException.NotFound e) {
            // The channel or its webhook was deleted in Discord.
            log.info("The {} log channel of guild {} is gone — forgetting it", channel, guildId);
            forget(guildId, channel);
        } catch (Exception e) {
            log.warn("The {} log channel of guild {} refused a message: {}", channel, guildId,
                    WebhookUrlCipher.redact(e.getMessage()));
        }
    }

    private void forget(Long guildId, Channel channel) {
        guildRepository.findById(guildId).ifPresent(g -> {
            if (channel == Channel.RESPONSES) {
                g.setLogResponsesWebhook(null);
                g.setLogResponsesChannelId(null);
            } else {
                g.setLogAuditWebhook(null);
                g.setLogAuditChannelId(null);
            }
            guildRepository.save(g);
        });
    }

    private void send(DiscordWebhookUrl webhook, Map<String, Object> embed) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("embeds", List.of(embed));
        payload.put("allowed_mentions", Map.of("parse", List.of()));
        restTemplate.postForEntity(webhook.canonical(), new HttpEntity<>(payload, headers), String.class);
    }

    private Map<String, Object> auditEmbed(AuditLog entry) {
        Map<String, Object> embed = new LinkedHashMap<>();
        embed.put("title", title(entry.getAction()));
        embed.put("color", color(entry.getAction()));
        if (entry.getCreatedAt() != null) {
            embed.put("timestamp", entry.getCreatedAt().atZone(java.time.ZoneId.systemDefault()).toOffsetDateTime().toString());
        }
        List<Map<String, Object>> fields = new ArrayList<>();
        if (entry.getActorDiscordId() != null) {
            fields.add(field("Кто", "<@" + entry.getActorDiscordId() + ">"
                    + (entry.getActorUsername() != null ? " · " + entry.getActorUsername() : ""), true));
        } else if (entry.getActorUsername() != null) {
            fields.add(field("Кто", entry.getActorUsername(), true));
        }
        if (entry.getTargetName() != null) fields.add(field("Что", entry.getTargetName(), true));
        if (entry.getDetails() != null && !entry.getDetails().isBlank()) {
            fields.add(field("Подробности", WebhookUrlCipher.redact(entry.getDetails()), false));
        }
        if (!fields.isEmpty()) embed.put("fields", fields);
        embed.put("footer", Map.of("text", "MarForms · журнал сервера"));
        return embed;
    }

    static Map<String, Object> field(String name, String value, boolean inline) {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("name", name);
        f.put("value", value.length() > 1024 ? value.substring(0, 1021) + "…" : value);
        f.put("inline", inline);
        return f;
    }

    private static String title(AuditAction action) {
        return switch (action) {
            case FORM_CREATED -> "Форма создана";
            case FORM_UPDATED -> "Форма изменена";
            case FORM_DELETED -> "Форма удалена";
            case FORM_STATUS_CHANGED -> "Статус формы изменён";
            case SUBMISSION_CREATED -> "Новый ответ";
            case SUBMISSION_DECIDED -> "Решение по ответу";
            case SUBMISSION_DELETED -> "Ответ удалён";
            case SUBMISSION_DM_FAILED -> "Личное сообщение о решении не доставлено";
            case MODERATOR_ADDED -> "Модератор добавлен";
            case MODERATOR_REMOVED -> "Модератор снят";
            case MODERATOR_FORMS_CHANGED -> "Формы модератора изменены";
            case GUILD_BAN_ADDED -> "Участник заблокирован";
            case GUILD_BAN_REMOVED -> "Участник разблокирован";
            case GUILD_CONNECTED -> "Сервер подключён";
            case GUILD_ROLE_REVOKED -> "Права на сервере сняты";
            case GUILD_ROLE_GRANTED -> "Новый владелец сервера по админ-роли";
            case GUILD_ADMIN_ROLES_CHANGED -> "Админ-роли изменены";
            case GUILD_LOG_CHANNELS_CREATED -> "Каналы логов созданы";
            case BOT_REMOVED -> "Бот удалён с сервера";
            case BOT_RECONNECTED -> "Бот снова на сервере";
            case BOT_PERMISSIONS_MISSING -> "Боту не хватает прав";
            case WEBHOOK_FAILING -> "Вебхук не доставляет";
            case WEBHOOK_CREATED -> "Канал подключён к форме";
            default -> action.name();
        };
    }

    private static int color(AuditAction action) {
        return switch (action) {
            case FORM_DELETED, SUBMISSION_DELETED, MODERATOR_REMOVED, GUILD_BAN_ADDED, GUILD_ROLE_REVOKED, BOT_REMOVED -> 0xED4245;
            case FORM_CREATED, SUBMISSION_CREATED, MODERATOR_ADDED, GUILD_BAN_REMOVED, GUILD_CONNECTED, GUILD_ROLE_GRANTED,
                 GUILD_LOG_CHANNELS_CREATED, BOT_RECONNECTED, WEBHOOK_CREATED -> 0x57F287;
            case SUBMISSION_DM_FAILED, BOT_PERMISSIONS_MISSING, WEBHOOK_FAILING, GUILD_ADMIN_ROLES_CHANGED,
                 MODERATOR_FORMS_CHANGED -> 0xFEE75C;
            case SUBMISSION_DECIDED -> 0xEB459E;
            default -> 0x5865F2;
        };
    }
}
