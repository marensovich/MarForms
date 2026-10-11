package me.marensovich.gta5rpformapp.backend.service;

import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

import static me.marensovich.gta5rpformapp.backend.data.settings.SystemSettings.KEY_LOG_WEBHOOK_URL;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

/**
 * The audit log webhook is called after commit, off the request thread, and
 * never for a rolled-back action (#103).
 */
@SpringBootTest
class AuditLogDispatcherTest {

    private static final String WEBHOOK = "https://discord.com/api/webhooks/5/audit";

    @Autowired
    private AuditLogService auditLogService;
    @Autowired
    private SettingsService settingsService;
    @Autowired
    private TransactionTemplate transactions;
    @MockitoBean
    private RestTemplate restTemplate;

    @BeforeEach
    void setUp() {
        settingsService.updateSettings(Map.of(KEY_LOG_WEBHOOK_URL, WEBHOOK));
    }

    @AfterEach
    void tearDown() {
        settingsService.updateSettings(Map.of(KEY_LOG_WEBHOOK_URL, ""));
    }

    @Test
    void sentOnlyAfterCommit() {
        transactions.executeWithoutResult(status -> {
            auditLogService.logGuildActionAs(1L, "a", 10L, AuditAction.MODERATOR_ADDED, "USER", "2", "b", null, null);
            verify(restTemplate, after(300).never()).postForEntity(any(String.class), any(), eq(String.class));
        });
        verify(restTemplate, timeout(2000)).postForEntity(eq(WEBHOOK), any(), eq(String.class));
    }

    @Test
    void neverSentForARolledBackAction() {
        transactions.executeWithoutResult(status -> {
            auditLogService.logGuildActionAs(1L, "a", 10L, AuditAction.MODERATOR_REMOVED, "USER", "2", "b", null, null);
            status.setRollbackOnly();
        });
        verify(restTemplate, after(500).never()).postForEntity(any(String.class), any(), eq(String.class));
    }
}
