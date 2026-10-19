package me.marensovich.gta5rpformapp.backend.service;

import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.database.entity.AuditLog;
import me.marensovich.gta5rpformapp.backend.database.repository.AuditLogRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Saving a form several times in a row leaves one «Форма изменена» (2026-10-19). */
@SpringBootTest
@Transactional
class AuditMergeIntegrationTest {

    private static final long GUILD = 9401L;

    @Autowired
    private AuditLogService auditLogService;
    @Autowired
    private AuditLogRepository auditLogRepository;

    private List<AuditLog> entries() {
        return auditLogRepository.findAll().stream().filter(a -> Long.valueOf(GUILD).equals(a.getGuildId())).toList();
    }

    @Test
    void backToBackEditsOfOneFormByOnePersonAreOneEntry() {
        for (String change : List.of("schema", "webhooks", "schema")) {
            auditLogService.logGuildActionAs(1L, "owner", GUILD, AuditAction.FORM_UPDATED, "FORM", "form-1", "Form",
                    Map.of("changes", List.of(change)), change);
        }

        List<AuditLog> entries = entries();
        assertThat(entries).hasSize(1);
        assertThat(entries.getFirst().getLastAt()).isNotNull();
        assertThat(entries.getFirst().getMetadata()).containsEntry("edits", 3)
                .containsEntry("changes", List.of("schema", "webhooks"));
    }

    @Test
    void anotherPersonOrAnotherFormStartsItsOwnEntry() {
        auditLogService.logGuildActionAs(1L, "owner", GUILD, AuditAction.FORM_UPDATED, "FORM", "form-1", "Form", null, null);
        auditLogService.logGuildActionAs(2L, "other", GUILD, AuditAction.FORM_UPDATED, "FORM", "form-1", "Form", null, null);
        auditLogService.logGuildActionAs(1L, "owner", GUILD, AuditAction.FORM_UPDATED, "FORM", "form-2", "Form 2", null, null);
        auditLogService.logGuildActionAs(1L, "owner", GUILD, AuditAction.FORM_CREATED, "FORM", "form-3", "Form 3", null, null);

        assertThat(entries()).hasSize(4);
    }
}
