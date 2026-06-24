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
public interface UserRepository extends JpaRepository<User, Long> {

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
     * Retrieves a paginated list of users with optional search and role filters.
     * <p>
     * Supports filtering by:
     * <ul>
     *     <li><b>Search</b> — matches against {@code discordUsername} (case-insensitive)
     *     or {@code discordId} (partial match)</li>
     *     <li><b>Role ID</b> — filters users who have a specific role assigned</li>
     * </ul>
     * If a parameter is {@code null}, the filter is ignored.
     * </p>
     * <p>
     * <b>Note:</b> This method uses native SQL for better performance with large datasets.
     * </p>
     *
     * @param search   optional search string for username or Discord ID (case-insensitive)
     * @param roleId   optional role UUID to filter users by role
     * @param pageable pagination parameters (page, size, sort)
     * @return a {@link Page} of {@link User} entities matching the filters
     * @since v.0.1
     */
    @Query(
            value = """
                    SELECT u.* FROM users u
                    WHERE (:search IS NULL OR
                           LOWER(u.discord_username) LIKE LOWER(CONCAT('%', :search, '%'))
                           OR u.discord_id::text LIKE CONCAT('%', :search, '%'))
                    AND (:roleId IS NULL OR EXISTS (
                        SELECT 1 FROM user_roles ur
                        WHERE ur.user_id = u.id AND ur.role_id = CAST(:roleId AS uuid)
                    ))
                    ORDER BY u.id ASC
                    """,
            countQuery = """
                    SELECT COUNT(*) FROM users u
                    WHERE (:search IS NULL OR
                           LOWER(u.discord_username) LIKE LOWER(CONCAT('%', :search, '%'))
                           OR u.discord_id::text LIKE CONCAT('%', :search, '%'))
                    AND (:roleId IS NULL OR EXISTS (
                        SELECT 1 FROM user_roles ur
                        WHERE ur.user_id = u.id AND ur.role_id = CAST(:roleId AS uuid)
                    ))
                    """,
            nativeQuery = true
    )
    Page<User> findAllWithFilters(
            @Param("search") String search,
            @Param("roleId") UUID roleId,
            Pageable pageable
    );

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
}