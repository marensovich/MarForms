package me.marensovich.gta5rpformapp.backend.dto.notification;

import me.marensovich.gta5rpformapp.backend.data.notifications.NotificationType;
import me.marensovich.gta5rpformapp.backend.database.entity.Notification;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * A notification of the bell (#122).
 *
 * @param id        its ID
 * @param type      what it is about; the client renders the text from it
 * @param guildId   the server, if any
 * @param targetId  the object, if any
 * @param params    names for the text
 * @param link      the panel path to open
 * @param createdAt when
 * @param read      whether it was read
 * @author marensovich
 * @since v.0.1
 */
public record NotificationDto(
        UUID id,
        NotificationType type,
        String guildId,
        String targetId,
        Map<String, String> params,
        String link,
        LocalDateTime createdAt,
        boolean read
) {
    public static NotificationDto from(Notification n) {
        return new NotificationDto(n.getId(), n.getType(), n.getGuildId() != null ? n.getGuildId().toString() : null,
                n.getTargetId(), n.getParams() != null ? n.getParams() : Map.of(), n.getLink(), n.getCreatedAt(),
                n.getReadAt() != null);
    }
}
