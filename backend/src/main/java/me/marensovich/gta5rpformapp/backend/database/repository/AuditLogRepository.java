package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * Repository interface for {@link AuditLog} entities.
 * <p>
 * Provides CRUD operations and custom query methods for managing
 * audit log entries. The journal filters through specifications.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID>, JpaSpecificationExecutor<AuditLog> {

    /** Retention (ТЗ 6.5): drops the entries before the given moment. */
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("delete from AuditLog a where a.createdAt < :before")
    int deleteOlderThan(java.time.LocalDateTime before);

    /** Who acted in a guild's journal (ТЗ 4.6.2 «Кто»): people only, the bot's own lines have no actor. */
    @org.springframework.data.jpa.repository.Query("""
            select a.actorDiscordId as discordId, max(a.actorUsername) as username from AuditLog a
            where a.guildId = :guildId and a.actorDiscordId is not null
            group by a.actorDiscordId order by max(a.actorUsername)""")
    java.util.List<Actor> findActorsByGuildId(Long guildId);

    /** The latest entry of one kind by one person on one target — to merge back-to-back edits into it. */
    java.util.Optional<AuditLog> findFirstByGuildIdAndActionAndTargetIdAndActorDiscordIdOrderByCreatedAtDesc(
            Long guildId, me.marensovich.gta5rpformapp.backend.data.audit.AuditAction action, String targetId, Long actorDiscordId);

    interface Actor {
        Long getDiscordId();

        String getUsername();
    }
}