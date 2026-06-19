package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

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
}