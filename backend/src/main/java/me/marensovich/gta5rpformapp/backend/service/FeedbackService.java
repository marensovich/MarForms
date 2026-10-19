package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.database.entity.Feedback;
import me.marensovich.gta5rpformapp.backend.database.repository.FeedbackRepository;
import me.marensovich.gta5rpformapp.backend.exception.FieldValidationException;
import me.marensovich.gta5rpformapp.backend.exception.TooManyRequestsException;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordWebhookUrl;
import me.marensovich.gta5rpformapp.backend.service.discord.WebhookUrlCipher;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Feedback about MarForms itself (2026-10-19): each kind asks its own
 * questions; a sent one is kept and posted to the platform's feedback
 * webhook, set in the platform's settings.
 *
 * @author marensovich
 * @since v.0.1
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeedbackService {

    public static final String KEY_WEBHOOK = "feedback.webhook.url";
    /** At most this many a person per hour: it's a form to us, not a chat. */
    static final int PER_HOUR = 5;

    /** A question of a kind of feedback; {@code options} limit a choice. */
    record Question(String id, String label, boolean required, int max, List<String> options) {
        static Question text(String id, String label, boolean required, int max) {
            return new Question(id, label, required, max, List.of());
        }

        static Question choice(String id, String label, List<String> options) {
            return new Question(id, label, true, 40, options);
        }
    }

    /** Each kind's questions, in order; the labels are how the webhook names them. */
    static final Map<Feedback.Type, List<Question>> QUESTIONS = Map.of(
            Feedback.Type.BUG, List.of(
                    Question.text("title", "Что сломалось", true, 120),
                    Question.text("steps", "Как повторить", true, 2000),
                    Question.text("expected", "Что ожидалось", false, 1000),
                    Question.text("actual", "Что произошло", true, 1000),
                    Question.choice("severity", "Насколько мешает", List.of("BLOCKER", "ANNOYING", "MINOR")),
                    Question.text("where", "Где (страница, сервер, форма)", false, 300)),
            Feedback.Type.IDEA, List.of(
                    Question.text("title", "Идея коротко", true, 120),
                    Question.text("problem", "Какую задачу решает", true, 1500),
                    Question.text("proposal", "Как это должно работать", true, 2000),
                    Question.text("audience", "Кому пригодится", false, 500)),
            Feedback.Type.PROBLEM, List.of(
                    Question.text("title", "В чём проблема", true, 120),
                    Question.choice("area", "Что под угрозой", List.of("SECURITY", "DATA", "ABUSE", "USABILITY", "OTHER")),
                    Question.text("description", "Описание", true, 2000),
                    Question.text("impact", "Чем грозит", false, 1000),
                    Question.text("suggestion", "Как исправить", false, 1000)),
            Feedback.Type.OTHER, List.of(
                    Question.text("subject", "Тема", true, 120),
                    Question.text("message", "Сообщение", true, 2000)));

    private static final Map<Feedback.Type, String> TITLES = Map.of(
            Feedback.Type.BUG, "🐞 Баг", Feedback.Type.IDEA, "💡 Предложение",
            Feedback.Type.PROBLEM, "⚠️ Потенциальная проблема", Feedback.Type.OTHER, "💬 Обратная связь");
    private static final Map<Feedback.Type, Integer> COLORS = Map.of(
            Feedback.Type.BUG, 0xED4245, Feedback.Type.IDEA, 0x57F287,
            Feedback.Type.PROBLEM, 0xFEE75C, Feedback.Type.OTHER, 0x5865F2);

    private final FeedbackRepository feedbackRepository;
    private final SettingsService settingsService;
    private final RestTemplate restTemplate;

    /**
     * Keeps a person's feedback and posts it to the feedback webhook.
     *
     * @param type     the kind
     * @param answers  question id → answer; unknown questions are dropped
     * @param page     the panel page it came from, may be {@code null}
     * @return the kept feedback; {@code delivered} says whether the webhook took it
     * @throws FieldValidationException if a required answer is missing or one is too long
     * @throws TooManyRequestsException if they sent {@value #PER_HOUR} within the hour
     * @since v.0.1
     */
    public Feedback submit(Long discordId, @Nullable String username, Feedback.Type type,
                           Map<String, String> answers, @Nullable String page) {
        if (feedbackRepository.countByAuthorDiscordIdAndCreatedAtAfter(discordId, LocalDateTime.now().minusHours(1)) >= PER_HOUR) {
            throw new TooManyRequestsException("You've sent a lot of feedback this hour — try again later");
        }
        Map<String, String> clean = new LinkedHashMap<>();
        Map<String, String> errors = new LinkedHashMap<>();
        for (Question q : QUESTIONS.get(type)) {
            String value = answers == null || answers.get(q.id()) == null ? "" : answers.get(q.id()).trim();
            if (value.isEmpty()) {
                if (q.required()) errors.put(q.id(), "required");
                continue;
            }
            if (value.length() > q.max()) errors.put(q.id(), "tooLong");
            else if (!q.options().isEmpty() && !q.options().contains(value)) errors.put(q.id(), "unknownOption");
            else clean.put(q.id(), value);
        }
        if (!errors.isEmpty()) throw new FieldValidationException("Check the answers", errors);

        Feedback feedback = new Feedback();
        feedback.setType(type);
        feedback.setAuthorDiscordId(discordId);
        feedback.setAuthorUsername(username);
        feedback.setAnswers(clean);
        feedback.setPage(page == null || page.isBlank() ? null : page.trim().substring(0, Math.min(300, page.trim().length())));
        feedback = feedbackRepository.save(feedback);

        String url = settingsService.get(KEY_WEBHOOK, "");
        DiscordWebhookUrl webhook = DiscordWebhookUrl.parse(url).orElse(null);
        if (webhook != null && post(webhook, embed(feedback))) {
            feedback.setDelivered(true);
            feedback = feedbackRepository.save(feedback);
        }
        return feedback;
    }

    /** The feedback webhook's address, as saved. */
    public String webhookUrl() {
        return settingsService.get(KEY_WEBHOOK, "");
    }

    /**
     * Saves the feedback webhook; empty turns it off.
     *
     * @throws FieldValidationException if it isn't a Discord webhook
     * @since v.0.1
     */
    public String setWebhookUrl(String url) {
        String value = url == null ? "" : url.trim();
        if (!value.isEmpty() && DiscordWebhookUrl.parse(value).isEmpty()) {
            throw new FieldValidationException("Invalid settings",
                    Map.of("webhookUrl", "Must be a Discord webhook URL: https://discord.com/api/webhooks/<id>/<token>"));
        }
        settingsService.updateSettings(new LinkedHashMap<>(Map.of(KEY_WEBHOOK, value)));
        return webhookUrl();
    }

    /**
     * A test message to the given webhook, or to the saved one.
     *
     * @return whether Discord took it
     * @throws IllegalArgumentException if there is no Discord webhook to send to
     * @since v.0.1
     */
    public boolean test(@Nullable String url) {
        String target = url != null && !url.isBlank() ? url : webhookUrl();
        DiscordWebhookUrl webhook = DiscordWebhookUrl.parse(target).orElseThrow(
                () -> new IllegalArgumentException("That's not a Discord webhook URL"));
        Map<String, Object> embed = new LinkedHashMap<>();
        embed.put("title", "MarForms · проверка обратной связи");
        embed.put("description", "Сюда будут приходить баги, предложения и сообщения о проблемах от пользователей.");
        embed.put("color", 0x5865F2);
        return post(webhook, embed);
    }

    private Map<String, Object> embed(Feedback f) {
        Map<String, Object> embed = new LinkedHashMap<>();
        List<Question> questions = QUESTIONS.get(f.getType());
        String headline = f.getAnswers().getOrDefault(questions.getFirst().id(), "");
        embed.put("title", TITLES.get(f.getType()) + " · " + headline);
        embed.put("color", COLORS.get(f.getType()));
        embed.put("timestamp", f.getCreatedAt().atZone(java.time.ZoneId.systemDefault()).toOffsetDateTime().toString());
        List<Map<String, Object>> fields = new ArrayList<>();
        for (Question q : questions.subList(1, questions.size())) {
            String value = f.getAnswers().get(q.id());
            if (value != null) fields.add(GuildLogService.field(q.label(), WebhookUrlCipher.redact(value), q.max() <= 300));
        }
        fields.add(GuildLogService.field("От кого", "<@" + f.getAuthorDiscordId() + ">"
                + (f.getAuthorUsername() != null ? " · " + f.getAuthorUsername() : ""), true));
        if (f.getPage() != null) fields.add(GuildLogService.field("Страница", f.getPage(), true));
        embed.put("fields", fields);
        embed.put("footer", Map.of("text", "MarForms · обратная связь · " + f.getId()));
        return embed;
    }

    private boolean post(DiscordWebhookUrl webhook, Map<String, Object> embed) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            restTemplate.postForEntity(webhook.canonical(),
                    new HttpEntity<>(Map.of("embeds", List.of(embed), "allowed_mentions", Map.of("parse", List.of())), headers), String.class);
            return true;
        } catch (Exception e) {
            log.warn("The feedback webhook refused a message: {}", WebhookUrlCipher.redact(e.getMessage()));
            return false;
        }
    }
}
