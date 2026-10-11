package me.marensovich.gta5rpformapp.backend.service.jobs;

import me.marensovich.gta5rpformapp.backend.data.jobs.OutboundJobStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.OutboundJob;
import me.marensovich.gta5rpformapp.backend.database.repository.OutboundJobRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Finished jobs (whose payloads copy answers) are deleted after the
 * retention period; pending ones never are (#103).
 */
@SpringBootTest
@Transactional
class OutboundJobRetentionTest {

    @Autowired
    private OutboundJobService outboundJobService;
    @Autowired
    private OutboundJobRepository repository;
    @Autowired
    private JdbcTemplate jdbc;

    private UUID job(OutboundJobStatus status, int daysAgo) {
        UUID id = outboundJobService.enqueue("test", Map.of("answer", "personal data")).getId();
        OutboundJob job = repository.findById(id).orElseThrow();
        job.setStatus(status);
        repository.saveAndFlush(job);
        jdbc.update("UPDATE outbound_jobs SET updated_at = ? WHERE id = ?", LocalDateTime.now().minusDays(daysAgo), id);
        return id;
    }

    @Test
    void oldFinishedJobsAreDeletedAndPendingOnesKept() {
        UUID oldDone = job(OutboundJobStatus.SUCCEEDED, 30);
        UUID oldFailed = job(OutboundJobStatus.FAILED, 30);
        UUID recentDone = job(OutboundJobStatus.SUCCEEDED, 1);
        UUID oldPending = job(OutboundJobStatus.PENDING, 30);

        outboundJobService.deleteOldJobs();

        assertThat(repository.findAllById(java.util.List.of(oldDone, oldFailed, recentDone, oldPending)))
                .extracting(OutboundJob::getId).containsExactlyInAnyOrder(recentDone, oldPending);
    }
}
