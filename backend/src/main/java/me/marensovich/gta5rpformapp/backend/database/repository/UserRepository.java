package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for accessing {@link User} entities in the database.
 * <p>
 * Provides CRUD operations and custom query methods for user management.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long>, org.springframework.data.jpa.repository.JpaSpecificationExecutor<User> {

    /**
     * Retrieves a user by their Discord ID.
     * <p>
     * Discord ID is the primary unique identifier used for authentication
     * and linking with Discord's API.
     * </p>
     *
     * @param discordId the Discord ID of the user to retrieve
     * @return an {@link Optional} containing the found {@link User} or empty if not found
     * @since v.0.1
     */
    Optional<User> findByDiscordId(Long discordId);

    /**
     * Checks if any user is assigned a specific role.
     * <p>
     * Used to prevent deletion of roles that are currently assigned to users.
     * </p>
     *
     * @param roleId the UUID of the role to check
     * @return {@code true} if at least one user has the specified role,
     * {@code false} otherwise
     * @since v.0.1
     */
    boolean existsByRoles_Id(UUID roleId);

    /**
     * Retrieves a list of users whose Discord username contains the specified string.
     * <p>
     * The search is case-insensitive and performs a partial match.
     * Useful for autocomplete or quick user lookup by username.
     * </p>
     *
     * @param username the username string to search for (case-insensitive)
     * @return a {@link List} of {@link User} entities matching the search criteria
     * @since v.0.1
     */
    List<User> findAllByDiscordUsernameContainingIgnoreCase(String username);

    /**
     * Batch lookup by Discord ID — e.g. usernames for a page of submissions.
     *
     * @param discordIds the Discord IDs
     * @return the users that exist among them
     * @since v.0.1
     */
    List<User> findAllByDiscordIdIn(java.util.Collection<Long> discordIds);

    /**
     * Users whose Discord username contains the text, with a result limit —
     * the ⌘K search (#107).
     *
     * @param username part of the username, any case
     * @param pageable the result limit
     * @return matching users
     * @since v.0.1
     */
    List<User> findByDiscordUsernameContainingIgnoreCase(String username, Pageable pageable);

    /** How many users hold this permission through any of their roles (the last System Admin keeps it, ТЗ 2.3). */
    @org.springframework.data.jpa.repository.Query("select count(distinct u.id) from User u join u.roles r join r.permissions p where p = :permission")
    long countWithPermission(me.marensovich.gta5rpformapp.backend.data.roles.Permission permission);

    /** Stamps the user's latest request without touching the rest of the row (#144). */
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update User u set u.lastSeenAt = :at where u.id = :id")
    void touch(Long id, java.time.LocalDateTime at);
}
