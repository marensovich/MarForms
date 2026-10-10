package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.database.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * Repository interface for {@link AuditLog} entities.
 * <p>
 * Provides CRUD operations and custom query methods for managing
 * audit log entries. Supports filtering by action type and actor.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID>, JpaSpecificationExecutor<AuditLog> {

    /**
     * Retrieves a paginated list of audit log entries by action type.
     * <p>
     * Useful for filtering logs by specific events (e.g., all
     * {@code USER_BANNED} or {@code FORM_CREATED} events).
     * </p>
     *
     * @param action   the {@link AuditAction} to filter by
     * @param pageable pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link AuditLog} entities with the specified action
     * @since v.0.1
     */
    Page<AuditLog> findAllByAction(AuditAction action, Pageable pageable);

    /**
     * Retrieves a paginated list of audit log entries by actor Discord ID.
     * <p>
     * Useful for viewing all actions performed by a specific user.
     * </p>
     *
     * @param actorDiscordId the Discord ID of the actor
     * @param pageable       pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link AuditLog} entities performed by the specified user
     * @since v.0.1
     */
    Page<AuditLog> findAllByActorDiscordId(Long actorDiscordId, Pageable pageable);

    /**
     * Retrieves a paginated list of audit log entries by action type and actor.
     * <p>
     * Useful for viewing specific actions performed by a specific user
     * (e.g., all forms created by a particular administrator).
     * </p>
     *
     * @param action         the {@link AuditAction} to filter by
     * @param actorDiscordId the Discord ID of the actor
     * @param pageable       pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link AuditLog} entities matching both filters
     * @since v.0.1
     */
    Page<AuditLog> findAllByActionAndActorDiscordId(AuditAction action, Long actorDiscordId, Pageable pageable);
}