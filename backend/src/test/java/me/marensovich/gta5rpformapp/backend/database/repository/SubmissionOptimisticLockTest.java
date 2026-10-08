package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Two moderators load the same submission and both decide: the second
 * (stale) write must fail rather than silently overwrite the first (#53).
 * Runs without a test transaction so each save is its own transaction.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class SubmissionOptimisticLockTest {

    @Autowired
    private SubmissionRepository submissionRepository;

    @Test
    void aStaleDecisionIsRejected() {
        Submission s = new Submission();
        s.setFormId(UUID.randomUUID());
        s.setAnswers(Map.of());
        UUID id = submissionRepository.save(s).getId();

        Submission first = submissionRepository.findById(id).orElseThrow();
        Submission second = submissionRepository.findById(id).orElseThrow();
        assertThat(first.getVersion()).isEqualTo(0L);

        first.setStatus(SubmissionStatus.APPROVED);
        submissionRepository.save(first);

        second.setStatus(SubmissionStatus.REJECTED);
        assertThatThrownBy(() -> submissionRepository.save(second))
                .isInstanceOf(ObjectOptimisticLockingFailureException.class);

        assertThat(submissionRepository.findById(id).orElseThrow().getStatus()).isEqualTo(SubmissionStatus.APPROVED);
        submissionRepository.deleteById(id);
    }
}
