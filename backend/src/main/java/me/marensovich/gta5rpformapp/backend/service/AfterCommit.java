package me.marensovich.gta5rpformapp.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Runs side effects that can't be rolled back — deleting stored files,
 * calling Discord — only once the database change they belong to is
 * committed (#103). Outside a transaction they run right away.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
public final class AfterCommit {

    private AfterCommit() {
    }

    public static void run(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            action.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    action.run();
                } catch (Exception e) {
                    log.warn("After-commit action failed: {}", e.getMessage());
                }
            }
        });
    }
}
