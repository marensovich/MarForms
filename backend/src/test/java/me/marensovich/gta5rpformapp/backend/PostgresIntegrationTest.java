package me.marensovich.gta5rpformapp.backend;

import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.service.SubmissionService;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The same checks the H2 suite can't make (#103): the real Flyway migrations
 * on Postgres, Hibernate validating the entities against them, JSONB
 * columns, and row locks. Needs Docker; skipped without it (CI has it).
 */
@SpringBootTest(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect",
})
@Testcontainers(disabledWithoutDocker = true)
class PostgresIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private Flyway flyway;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private SubmissionRepository submissionRepository;
    @Autowired
    private SubmissionService submissionService;

    @Test
    void everyMigrationAppliesAndTheEntitiesMatchTheSchema() {
        // The context only starts if ddl-auto=validate accepts the migrated schema.
        assertThat(flyway.info().pending()).isEmpty();
        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("39");
    }

    @Test
    void webhookUrlsAreEncryptedInTheJsonbColumn() {
        WebhookConfig webhook = new WebhookConfig();
        webhook.setUrl("https://discord.com/api/webhooks/42/pg-secret-token");
        Form form = form("pg-webhooks", null);
        form.setWebhooks(List.of(webhook));
        form = formRepository.save(form);

        String raw = jdbc.queryForObject("SELECT webhooks::text FROM form WHERE id = ?", String.class, form.getId());
        assertThat(raw).doesNotContain("pg-secret-token").contains("enc:v1:");
        assertThat(formRepository.findById(form.getId()).orElseThrow().getWebhooks().getFirst().getUrl())
                .isEqualTo("https://discord.com/api/webhooks/42/pg-secret-token");
    }

    @Test
    void parallelSubmissionsRespectTheLimit() throws Exception {
        Form form = formRepository.save(form("pg-limit", 1));
        ExecutorService pool = Executors.newFixedThreadPool(8);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> results = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            results.add(pool.submit(() -> {
                start.await();
                return submissionService.submit(form, null, Map.of("name", "x"), null, "pg-concurrency-token-0123456789");
            }));
        }
        start.countDown();
        for (Future<?> result : results) {
            try {
                result.get();
            } catch (Exception refused) {
                // all but one are over the limit
            }
        }
        pool.shutdown();
        assertThat(submissionRepository.countByFormId(form.getId())).isEqualTo(1);
    }

    private static Form form(String slug, Integer limit) {
        FormField name = new FormField();
        name.setId("name");
        name.setType(FormField.FieldType.TEXT);
        name.setLabel("Name");
        FormSchema schema = new FormSchema();
        schema.setTitle("Postgres");
        schema.setFields(new ArrayList<>(List.of(name)));
        Form form = new Form();
        form.setServerId(9601L);
        form.setSchema(schema);
        form.setStatus(FormStatus.PUBLISHED);
        form.setActive(true);
        form.setSlug(slug);
        form.setAccessMode(FormAccessMode.ANONYMOUS);
        form.setSubmissionLimitPerUser(limit);
        return form;
    }
}
