package me.marensovich.gta5rpformapp.backend.service.forms;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.FormReminder;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.repository.FormReminderRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.exception.InvalidStateException;
import me.marensovich.gta5rpformapp.backend.service.WebhookService;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient.DmResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * «Напомнить в Discord» on a form that hasn't opened yet (#121, ТЗ 3.5
 * NOT_OPEN_YET): a signed-in user subscribes once per form, and when the form
 * opens the bot DMs them its link. The opening time is read when sending, so a
 * moved date is followed; a deleted form takes its reminders with it.
 *
 * @author marensovich
 * @since v.0.1
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FormReminderService {

    static final int MAX_ATTEMPTS = 5;
    private static final int BATCH = 50;

    private final FormReminderRepository reminderRepository;
    private final FormRepository formRepository;
    private final GuildRepository guildRepository;
    private final DiscordBotClient botClient;
    private final WebhookService webhookService;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    /**
     * Subscribes a user to the form's opening; asking twice is harmless.
     *
     * @param form      the form
     * @param discordId the user
     * @throws InvalidStateException if the form isn't waiting to open
     * @since v.0.1
     */
    @Transactional
    public void subscribe(Form form, Long discordId) {
        if (form.getStatus() != FormStatus.PUBLISHED || form.getOpensAt() == null
                || !form.getOpensAt().isAfter(LocalDateTime.now())) {
            throw new InvalidStateException("This form isn't waiting to open");
        }
        if (reminderRepository.existsByFormIdAndDiscordId(form.getId(), discordId)) return;
        FormReminder reminder = new FormReminder();
        reminder.setFormId(form.getId());
        reminder.setDiscordId(discordId);
        try {
            reminderRepository.saveAndFlush(reminder);
        } catch (DataIntegrityViolationException e) {
            // A second click raced the first; the reminder is there either way.
            log.debug("Reminder for form {} and user {} already exists", form.getId(), discordId);
        }
    }

    /**
     * Whether the user is subscribed to the form's opening.
     *
     * @param form      the form
     * @param discordId the user, or {@code null}
     * @return {@code true} if a reminder is set
     * @since v.0.1
     */
    @Transactional(readOnly = true)
    public boolean isSubscribed(Form form, Long discordId) {
        return discordId != null && reminderRepository.existsByFormIdAndDiscordId(form.getId(), discordId);
    }

    /**
     * Sends the reminders of forms that have opened. Closed DMs or no bot: given
     * up on at once; other failures are retried on the next runs, a few times.
     *
     * @since v.0.1
     */
    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    @Transactional
    public void sendDue() {
        for (FormReminder reminder : reminderRepository.findDue(FormStatus.PUBLISHED, LocalDateTime.now(), PageRequest.of(0, BATCH))) {
            Form form = formRepository.findById(reminder.getFormId()).orElse(null);
            if (form == null) continue;
            DmResult result = botClient.sendDirectMessage(reminder.getDiscordId(), embeds(form));
            reminder.setAttempts(reminder.getAttempts() + 1);
            if (result != DmResult.FAILED || reminder.getAttempts() >= MAX_ATTEMPTS) {
                reminder.setSentAt(LocalDateTime.now());
                if (result != DmResult.SENT) {
                    log.info("Opening reminder of form {} for user {} not delivered: {}", form.getId(), reminder.getDiscordId(), result);
                }
            }
            reminderRepository.save(reminder);
        }
    }

    List<Map<String, Object>> embeds(Form form) {
        String guildName = form.getServerId() == null ? null
                : guildRepository.findById(form.getServerId()).map(Guild::getName).orElse(null);
        String link = frontendUrl + "/f/" + form.getSlug();
        String title = form.getSchema() != null && form.getSchema().getTitle() != null ? form.getSchema().getTitle() : "";

        Map<String, Object> embed = new LinkedHashMap<>();
        embed.put("title", "Приём заявок открыт");
        embed.put("description", "**" + title + "**" + (guildName != null ? " · " + guildName : "")
                + "\n\nВы просили напомнить. Форма уже принимает заявки: [открыть форму](" + link + ")");
        embed.put("url", link);
        embed.put("color", 0x3730A3);
        if (form.getClosesAt() != null) {
            embed.put("fields", List.of(Map.of("name", "Приём закроется", "value",
                    "<t:" + form.getClosesAt().atZone(java.time.ZoneId.systemDefault()).toEpochSecond() + ":f>", "inline", false)));
        }
        List<Map<String, Object>> embeds = new ArrayList<>(List.of(embed));
        Map<String, Object> branding = webhookService.brandingEmbed(Map.of(
                "form_title", title,
                "form_id", form.getId().toString(),
                "server_id", form.getServerId() != null ? form.getServerId().toString() : ""));
        if (branding != null) embeds.add(branding);
        return embeds;
    }
}
