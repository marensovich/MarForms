package me.marensovich.gta5rpformapp.backend.service;

import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Concurrent submissions can't get past a per-user limit (#103). Not
 * {@code @Transactional}: each submission runs in its own transaction, as
 * in production.
 */
@SpringBootTest
class SubmissionLimitConcurrencyTest {

    private static final int THREADS = 8;
    private static final String TOKEN = "concurrency-test-token-0123456789";

    @Autowired
    private SubmissionService submissionService;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private SubmissionRepository submissionRepository;

    private Form form;

    @AfterEach
    void tearDown() {
        if (form != null) {
            submissionRepository.deleteAll(submissionRepository.findAllByFormId(form.getId(),
                    org.springframework.data.domain.Pageable.unpaged()).getContent());
            formRepository.deleteById(form.getId());
        }
    }

    @Test
    void parallelSubmissionsRespectTheLimit() throws Exception {
        FormField name = new FormField();
        name.setId("name");
        name.setType(FormField.FieldType.TEXT);
        name.setLabel("Name");
        FormSchema schema = new FormSchema();
        schema.setTitle("Limited");
        schema.setFields(new ArrayList<>(List.of(name)));
        form = new Form();
        form.setServerId(9501L);
        form.setSchema(schema);
        form.setStatus(FormStatus.PUBLISHED);
        form.setActive(true);
        form.setSlug("limited-concurrency");
        form.setAccessMode(FormAccessMode.ANONYMOUS);
        form.setSubmissionLimitPerUser(1);
        form = formRepository.save(form);

        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> results = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            results.add(pool.submit(() -> {
                start.await();
                return submissionService.submit(form, null, Map.of("name", "x"), null, TOKEN);
            }));
        }
        start.countDown();
        int succeeded = 0;
        for (Future<?> result : results) {
            try {
                result.get();
                succeeded++;
            } catch (Exception refused) {
                // "You have already submitted this form" — expected for all but one
            }
        }
        pool.shutdown();

        assertThat(succeeded).isEqualTo(1);
        assertThat(submissionRepository.findAllByFormId(form.getId(), org.springframework.data.domain.Pageable.unpaged())
                .getTotalElements()).isEqualTo(1);
    }
}
