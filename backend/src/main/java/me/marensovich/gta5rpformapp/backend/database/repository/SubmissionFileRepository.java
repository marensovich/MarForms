package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.SubmissionFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface SubmissionFileRepository extends JpaRepository<SubmissionFile, UUID> {

    List<SubmissionFile> findAllBySubmissionId(UUID submissionId);

    List<SubmissionFile> findAllBySubmissionIdIsNullAndCreatedAtBefore(LocalDateTime cutoff);

    /**
     * Files attached to a submission that no longer exists (deleted
     * directly, or with its form).
     *
     * @return the orphaned files
     * @since v.0.1
     */
    @Query("select f from SubmissionFile f where f.submissionId is not null "
            + "and not exists (select s.id from Submission s where s.id = f.submissionId)")
    List<SubmissionFile> findAllWithMissingSubmission();
}
