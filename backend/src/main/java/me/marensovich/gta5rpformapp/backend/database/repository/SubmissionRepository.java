package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import me.marensovich.gta5rpformapp.backend.dto.submission.UserSubmissionCountDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
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
public interface SubmissionRepository extends JpaRepository<Submission, UUID>, JpaSpecificationExecutor<Submission> {

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
     * A form's submissions one slice at a time, without the count query a
     * {@link Page} needs: for streaming exports (E3.3).
     *
     * @param formId   the form
     * @param pageable which slice
     * @return the slice
     * @since v.0.1
     */
    Slice<Submission> readAllByFormId(UUID formId, Pageable pageable);

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

    /**
     * How many times one respondent submitted one form — for
     * {@code Form#submissionLimitPerUser}.
     *
     * @param formId    the form
     * @param discordId the respondent's Discord ID
     * @return the submission count
     * @since v.0.1
     */
    long countByFormIdAndDiscordId(UUID formId, Long discordId);

    long countByFormIdAndAnonymousToken(UUID formId, String anonymousToken);

    /**
     * Finds the submission an idempotency key already produced.
     *
     * @param idempotencyKey the client-supplied key
     * @return the submission, if any
     * @since v.0.1
     */
    java.util.Optional<Submission> findByIdempotencyKey(String idempotencyKey);

    /**
     * Retrieves a paginated list of submissions made by a specific user.
     *
     * @param discordId the Discord ID of the user
     * @param pageable  pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link Submission} entities for the specified user
     * @since v.0.1
     */
    Page<Submission> findAllByDiscordId(Long discordId, Pageable pageable);

    /**
     * Retrieves a paginated list of submissions for a specific form made by a specific user.
     *
     * @param formId    the UUID of the form
     * @param discordId the Discord ID of the user
     * @param pageable  pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link Submission} entities matching both filters
     * @since v.0.1
     */
    Page<Submission> findAllByFormIdAndDiscordId(UUID formId, Long discordId, Pageable pageable);

    /**
     * Retrieves a paginated list of submissions made by any of the specified users.
     *
     * @param discordIds a collection of Discord IDs to filter by
     * @param pageable   pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link Submission} entities for the specified users
     * @since v.0.1
     */
    Page<Submission> findAllByDiscordIdIn(Collection<Long> discordIds, Pageable pageable);

    /**
     * Retrieves a paginated list of submissions for a specific form
     * made by any of the specified users.
     *
     * @param formId     the UUID of the form
     * @param discordIds a collection of Discord IDs to filter by
     * @param pageable   pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link Submission} entities matching all filters
     * @since v.0.1
     */
    Page<Submission> findAllByFormIdAndDiscordIdIn(UUID formId, Collection<Long> discordIds, Pageable pageable);

    /**
     * Retrieves a list of submission counts grouped by user.
     * <p>
     * Returns the total number of submissions each user has made across all forms.
     * Results are ordered by count in descending order (highest first).
     * </p>
     * <p>
     * Useful for leaderboards, activity tracking, and administrative dashboards.
     * </p>
     *
     * @return a {@link List} of {@link UserSubmissionCountDto} containing user submission statistics
     * @since v.0.1
     */
    @Query("SELECT new me.marensovich.gta5rpformapp.backend.dto.submission.UserSubmissionCountDto(s.discordId, COUNT(s)) " +
            "FROM Submission s GROUP BY s.discordId ORDER BY COUNT(s) DESC")
    List<UserSubmissionCountDto> findUserSubmissionCounts();
}