package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * Repository interface for accessing {@link Submission} entities in the database.
 * <p>
 * Provides CRUD operations and custom query methods for managing form submissions.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Repository
public interface SubmissionRepository extends JpaRepository<Submission, UUID> {

    /**
     * Retrieves a paginated list of all submissions for a specific form.
     * <p>
     * Useful for displaying submission history and administrative review.
     * </p>
     *
     * @param formId   the UUID of the form to retrieve submissions for
     * @param pageable pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link Submission} entities for the specified form
     * @since v.0.1
     */
    Page<Submission> findAllByFormId(UUID formId, Pageable pageable);

    /**
     * Counts the total number of submissions for a specific form.
     * <p>
     * Useful for displaying submission statistics and analytics.
     * </p>
     *
     * @param formId the UUID of the form to count submissions for
     * @return the total number of submissions for the specified form
     * @since v.0.1
     */
    long countByFormId(UUID formId);
}