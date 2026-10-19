package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.database.entity.AuditLog;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Sends audit entries to the log webhook after the action's transaction
 * commits, on the async executor (security audit, #103). A separate bean so
 * the {@code @Async} proxy is actually in the call path — the former
 * self-invoked {@code @Async} method ran inline inside the request.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Component
@RequiredArgsConstructor
public class AuditLogDispatcher {

    private final AuditLogService auditLogService;
    private final GuildLogService guildLogService;

    /** An audit entry waiting to be sent. */
    public record Dispatch(AuditLog entry) {
    }

    /**
     * Rolled-back actions are never announced; actions outside a transaction
     * are sent right away.
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onDispatch(Dispatch event) {
        auditLogService.dispatch(event.entry());
        // And the server's own #аудит / #ответы (2026-10-19).
        guildLogService.dispatch(event.entry());
    }
}
