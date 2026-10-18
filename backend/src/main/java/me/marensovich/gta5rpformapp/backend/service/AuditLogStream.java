package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import me.marensovich.gta5rpformapp.backend.database.entity.AuditLog;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.dto.audit.AuditLogDto;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * «Live» of the platform journal (ТЗ 6.5, #146): every entry, once its
 * transaction commits, goes to the open journal pages as a server-sent event.
 * One application, so the emitters live in memory — no broker (ADR 0001).
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuditLogStream {

    /** How long a connection stays open before the client reconnects. */
    static final long TIMEOUT_MS = 30 * 60 * 1000L;
    /** At most this many open journal pages at once. */
    static final int MAX_SUBSCRIBERS = 50;

    private final UserRepository userRepository;
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    /** An entry was saved. */
    public record Saved(AuditLog entry) {
    }

    /**
     * Opens a stream for one journal page.
     *
     * @return the emitter
     * @throws IllegalStateException if too many pages are open
     * @since v.0.1
     */
    public SseEmitter subscribe() {
        if (emitters.size() >= MAX_SUBSCRIBERS) throw new IllegalStateException("Too many live journal pages are open");
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));
        try {
            emitter.send(SseEmitter.event().comment("connected"));
        } catch (IOException e) {
            emitters.remove(emitter);
        }
        return emitter;
    }

    /** Sends a committed entry to every open page. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSaved(Saved event) {
        if (emitters.isEmpty()) return;
        AuditLog entry = event.entry();
        String avatar = entry.getActorDiscordId() == null ? null : userRepository.findByDiscordId(entry.getActorDiscordId())
                .map(AuditLogDto::avatarUrl).orElse(null);
        AuditLogDto dto = AuditLogDto.from(entry, avatar);
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("entry").data(dto, MediaType.APPLICATION_JSON));
            } catch (Exception e) {
                emitters.remove(emitter);
            }
        }
    }

    /** Keeps idle connections open through proxies. */
    @Scheduled(fixedDelay = 25_000)
    public void heartbeat() {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().comment("ping"));
            } catch (Exception e) {
                emitters.remove(emitter);
            }
        }
    }

    int subscribers() {
        return emitters.size();
    }
}
