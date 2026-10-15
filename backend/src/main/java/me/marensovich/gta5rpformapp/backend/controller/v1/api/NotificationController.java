package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.dto.notification.NotificationDto;
import me.marensovich.gta5rpformapp.backend.service.NotificationService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * The current user's bell (#122, ТЗ ФТ-4.1.2).
 *
 * @author marensovich
 * @since v.0.1
 */
@RestController
@RequestMapping("/api/v1/me/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    /**
     * Newest first; {@code unread=true} for the unread ones only.
     *
     * @param principal the current user
     * @param unread    only the unread ones
     * @param pageable  pagination
     * @return their notifications
     * @since v.0.1
     */
    @GetMapping
    public Page<NotificationDto> list(@AuthenticationPrincipal CustomUserDetails principal,
                                      @RequestParam(defaultValue = "false") boolean unread,
                                      @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return notificationService.list(principal.getDiscordId(), unread, pageable);
    }

    /**
     * The counter on the bell.
     *
     * @param principal the current user
     * @return {@code {"count": n}}
     * @since v.0.1
     */
    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount(@AuthenticationPrincipal CustomUserDetails principal) {
        return Map.of("count", notificationService.unreadCount(principal.getDiscordId()));
    }

    /**
     * Marks one read; 404 for anyone else's.
     *
     * @param principal the current user
     * @param id        the notification
     * @return 204
     * @since v.0.1
     */
    @PostMapping("/{id}/read")
    public ResponseEntity<Void> read(@AuthenticationPrincipal CustomUserDetails principal, @PathVariable UUID id) {
        notificationService.markRead(principal.getDiscordId(), id);
        return ResponseEntity.noContent().build();
    }

    /**
     * «Прочитать все».
     *
     * @param principal the current user
     * @return 204
     * @since v.0.1
     */
    @PostMapping("/read-all")
    public ResponseEntity<Void> readAll(@AuthenticationPrincipal CustomUserDetails principal) {
        notificationService.markAllRead(principal.getDiscordId());
        return ResponseEntity.noContent().build();
    }
}
