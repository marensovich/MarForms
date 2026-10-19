package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.data.notifications.NotificationType;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.Notification;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.NotificationRepository;
import me.marensovich.gta5rpformapp.backend.dto.notification.NotificationDto;
import me.marensovich.gta5rpformapp.backend.exception.NotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.lang.Nullable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The bell of the panel (#122, ТЗ ФТ-4.1.2, 7.2): who is told what.
 * <ul>
 *     <li>new submission, submission sent again → the server's moderators and owner;</li>
 *     <li>a webhook stopped working, the bot was removed → the owner.</li>
 * </ul>
 * Notifications are kept for 90 days.
 *
 * @author marensovich
 * @since v.0.1
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    static final Duration RETENTION = Duration.ofDays(90);

    private final NotificationRepository notificationRepository;
    private final GuildMembershipRepository guildMembershipRepository;

    /**
     * Tells a server's moderators and owner, except whoever caused it. About a
     * form, only moderators who work with it are told (#18).
     *
     * @param guildId  the server
     * @param formId   the form it is about, or {@code null}
     * @param type     what happened
     * @param targetId the object
     * @param params   names for the text
     * @param link     where clicking leads
     * @param except   who caused it (not told), or {@code null}
     * @since v.0.1
     */
    @Transactional
    public void notifyStaff(Long guildId, @Nullable UUID formId, NotificationType type, @Nullable String targetId,
                            Map<String, String> params, String link, @Nullable Long except) {
        Set<Long> recipients = new LinkedHashSet<>();
        recipients.addAll(memberIds(guildId, GuildRole.OWNER));
        recipients.addAll(formId == null ? memberIds(guildId, GuildRole.MODERATOR)
                : guildMembershipRepository.findStaffDiscordIdsForForm(guildId, GuildRole.MODERATOR, formId));
        if (except != null) recipients.remove(except);
        recipients.forEach(r -> save(r, type, guildId, targetId, params, link));
    }

    /**
     * Tells a server's owner.
     *
     * @param guildId  the server
     * @param type     what happened
     * @param targetId the object
     * @param params   names for the text
     * @param link     where clicking leads
     * @since v.0.1
     */
    @Transactional
    public void notifyOwner(Long guildId, NotificationType type, @Nullable String targetId,
                            Map<String, String> params, String link) {
        memberIds(guildId, GuildRole.OWNER).forEach(r -> save(r, type, guildId, targetId, params, link));
    }

    @Transactional(readOnly = true)
    public Page<NotificationDto> list(Long discordId, boolean unreadOnly, Pageable pageable) {
        Page<Notification> page = unreadOnly
                ? notificationRepository.findAllByRecipientDiscordIdAndReadAtIsNull(discordId, pageable)
                : notificationRepository.findAllByRecipientDiscordId(discordId, pageable);
        return page.map(NotificationDto::from);
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long discordId) {
        return notificationRepository.countByRecipientDiscordIdAndReadAtIsNull(discordId);
    }

    @Transactional
    public void markRead(Long discordId, UUID id) {
        Notification n = notificationRepository.findByIdAndRecipientDiscordId(id, discordId)
                .orElseThrow(() -> new NotFoundException("Notification not found: " + id));
        if (n.getReadAt() == null) {
            n.setReadAt(LocalDateTime.now());
            notificationRepository.save(n);
        }
    }

    @Transactional
    public int markAllRead(Long discordId) {
        return notificationRepository.markAllRead(discordId, LocalDateTime.now());
    }

    /** Older than 90 days: gone, read or not. */
    @Scheduled(cron = "0 41 3 * * *")
    @Transactional
    public void deleteOld() {
        int removed = notificationRepository.deleteOlderThan(LocalDateTime.now().minus(RETENTION));
        if (removed > 0) log.info("Deleted {} notifications older than {} days", removed, RETENTION.toDays());
    }

    private Set<Long> memberIds(Long guildId, GuildRole role) {
        Set<Long> ids = new LinkedHashSet<>();
        for (GuildMembership m : guildMembershipRepository.findAllByGuild_DiscordGuildIdAndRole(guildId, role)) {
            if (m.getUser() != null && m.getUser().getDiscordId() != null) ids.add(m.getUser().getDiscordId());
        }
        return ids;
    }

    private void save(Long recipient, NotificationType type, Long guildId, @Nullable String targetId,
                      Map<String, String> params, String link) {
        Notification n = new Notification();
        n.setRecipientDiscordId(recipient);
        n.setType(type);
        n.setGuildId(guildId);
        n.setTargetId(targetId);
        n.setParams(params.entrySet().stream().filter(e -> e.getValue() != null)
                .collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a, java.util.LinkedHashMap::new)));
        n.setLink(link);
        notificationRepository.save(n);
    }
}
