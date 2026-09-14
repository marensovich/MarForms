package me.marensovich.gta5rpformapp.backend.service.jobs;

import com.fasterxml.jackson.databind.ObjectMapper;
import me.marensovich.gta5rpformapp.backend.data.jobs.OutboundJobStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.OutboundJob;
import me.marensovich.gta5rpformapp.backend.database.repository.OutboundJobRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(OutboundJobServiceTest.Config.class)
class OutboundJobServiceTest {

    @TestConfiguration
    static class Config {
        @Bean
        OutboundJobService outboundJobService(OutboundJobRepository repository) {
            return new OutboundJobService(repository, new ObjectMapper());
        }
    }

    @Autowired
    private OutboundJobService outboundJobService;

    @Autowired
    private OutboundJobRepository outboundJobRepository;

    @Test
    void enqueueCreatesAPendingJobDueImmediately() {
        var job = outboundJobService.enqueue("test_job", Map.of("k", "v"));

        assertThat(job.getStatus()).isEqualTo(OutboundJobStatus.PENDING);
        assertThat(job.getAttempts()).isEqualTo(0);
        assertThat(job.getPayload()).containsEntry("k", "v");
        assertThat(job.getNextAttemptAt()).isBeforeOrEqualTo(LocalDateTime.now());
    }

    @Test
    void markSucceededTransitionsTheJobToSucceeded() {
        UUID jobId = outboundJobService.enqueue("test_job", Map.of()).getId();

        outboundJobService.markSucceeded(jobId);

        assertThat(outboundJobRepository.findById(jobId).orElseThrow().getStatus())
                .isEqualTo(OutboundJobStatus.SUCCEEDED);
    }

    @Test
    void markFailedIsPermanentRegardlessOfRemainingAttempts() {
        UUID jobId = outboundJobService.enqueue("test_job", Map.of()).getId();

        outboundJobService.markFailed(jobId, "not retryable");

        OutboundJob job = outboundJobRepository.findById(jobId).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(OutboundJobStatus.FAILED);
        assertThat(job.getLastError()).isEqualTo("not retryable");
    }

    @Test
    void rescheduleIncrementsAttemptsAndStaysPendingBelowMax() {
        UUID jobId = outboundJobService.enqueue("test_job", Map.of()).getId();
        LocalDateTime nextAttempt = LocalDateTime.now().plusMinutes(5);

        outboundJobService.reschedule(jobId, nextAttempt, "transient error");

        OutboundJob job = outboundJobRepository.findById(jobId).orElseThrow();
        assertThat(job.getStatus()).isEqualTo(OutboundJobStatus.PENDING);
        assertThat(job.getAttempts()).isEqualTo(1);
        assertThat(job.getNextAttemptAt()).isEqualTo(nextAttempt);
    }

    @Test
    void rescheduleMarksFailedOnceMaxAttemptsIsReached() {
        UUID jobId = outboundJobService.enqueue("test_job", Map.of()).getId();

        for (int i = 0; i < 5; i++) {
            outboundJobService.reschedule(jobId, LocalDateTime.now().plusSeconds(1), "still failing");
        }

        OutboundJob job = outboundJobRepository.findById(jobId).orElseThrow();
        assertThat(job.getAttempts()).isEqualTo(5);
        assertThat(job.getStatus()).isEqualTo(OutboundJobStatus.FAILED);
    }
}
