package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for accessing {@link Form} entities in the database.
 * <p>
 * Provides CRUD operations and custom query methods for form management.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Repository
public interface FormRepository extends JpaRepository<Form, UUID> {

    /**
     * Retrieves a paginated list of all active forms.
     * <p>
     * Only returns forms where the {@code active} flag is set to {@code true}.
     * Used for displaying available forms to users.
     * </p>
     *
     * @param pageable pagination parameters (page, size, sort)
     * @return a {@link Page} of active {@link Form} entities
     * @since v.0.1
     */
    Page<Form> findAllByActiveTrue(Pageable pageable);

    /**
     * A guild's forms, for the owner panel.
     *
     * @param serverId the Discord guild snowflake ID
     * @param pageable pagination parameters
     * @return the guild's forms
     * @since v.0.1
     */
    Page<Form> findAllByServerId(Long serverId, Pageable pageable);

    /**
     * A guild's forms, excluding one status (used to hide archived forms).
     *
     * @param serverId the Discord guild snowflake ID
     * @param status   the status to exclude
     * @param pageable pagination parameters
     * @return the matching forms
     * @since v.0.1
     */
    Page<Form> findAllByServerIdAndStatusNot(Long serverId, FormStatus status, Pageable pageable);

    /**
     * Whether a slug is already taken.
     *
     * @param slug the candidate slug
     * @return {@code true} if some form uses it
     * @since v.0.1
     */
    boolean existsBySlug(String slug);

    /**
     * IDs of a guild's forms — to scope submission queries to one guild.
     *
     * @param serverId the Discord guild snowflake ID
     * @return the guild's form IDs
     * @since v.0.1
     */
    @org.springframework.data.jpa.repository.Query("select f.id from Form f where f.serverId = :serverId")
    java.util.List<UUID> findIdsByServerId(@org.springframework.data.repository.query.Param("serverId") Long serverId);

    /**
     * Looks a form up by its public slug.
     *
     * @param slug the slug
     * @return the form, if any
     * @since v.0.1
     */
    Optional<Form> findBySlug(String slug);

    /**
     * Every form not in the given status (the webhook health check skips archived forms).
     *
     * @param status the status to exclude
     * @return the matching forms
     * @since v.0.1
     */
    List<Form> findAllByStatusNot(FormStatus status);

    /**
     * @param serverId the Discord guild snowflake ID
     * @param status   the status not counted
     * @return how many of the guild's forms are not in that status
     * @since v.0.1
     */
    long countByServerIdAndStatusNot(Long serverId, FormStatus status);

    /**
     * Locks a form's row until the transaction ends: serializes the
     * "count, then insert" of per-user submission limits (#103).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from Form f where f.id = :id")
    Optional<Form> lockById(UUID id);
}
