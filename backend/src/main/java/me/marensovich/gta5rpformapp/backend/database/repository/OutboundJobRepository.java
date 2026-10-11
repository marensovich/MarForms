package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.data.jobs.OutboundJobStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.OutboundJob;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Repository interface for accessing {@link OutboundJob} entities in the database.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Repository
public interface OutboundJobRepository extends JpaRepository<OutboundJob, UUID> {

    /**
     * Finds due jobs of a given type — status matches and {@code nextAttemptAt}
     * has passed — oldest-due first, capped at 20 per poll.
     * <p>
     * Single-instance assumption: this does not use a claim/lock step (e.g.
     * {@code SELECT ... FOR UPDATE SKIP LOCKED}), so running more than one
     * backend instance against the same database could double-process a job.
     * Fine for the current single-instance deployment; revisit if/when this
     * app runs horizontally scaled.
     * </p>
     *
     * @param jobType the job type to filter by
     * @param status  the status to filter by
     * @param now     the current time — jobs due at or before this are returned
     * @return up to 20 due jobs, oldest-due first
     * @since v.0.1
     */
    List<OutboundJob> findTop20ByJobTypeAndStatusAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(
            String jobType, OutboundJobStatus status, LocalDateTime now);

    /** Deletes finished jobs (in the given statuses) last touched before a cutoff. */
    @Modifying
    @Transactional
    @Query("DELETE FROM OutboundJob j WHERE j.status IN :statuses AND j.updatedAt < :cutoff")
    int deleteFinishedBefore(Collection<OutboundJobStatus> statuses, LocalDateTime cutoff);
}
