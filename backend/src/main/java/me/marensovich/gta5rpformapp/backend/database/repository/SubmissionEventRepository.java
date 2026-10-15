package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.SubmissionEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SubmissionEventRepository extends JpaRepository<SubmissionEvent, UUID> {

    /** A submission's history, oldest first. */
    List<SubmissionEvent> findAllBySubmissionIdOrderByCreatedAtAscIdAsc(UUID submissionId);
}
