package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for accessing {@link Role} entities in the database.
 * <p>
 * Provides CRUD operations and custom query methods for role management.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Repository
public interface RoleRepository extends JpaRepository<Role, UUID> {

    /**
     * Retrieves a role by its name.
     * <p>
     * Useful for finding predefined roles like "ADMIN", "MODERATOR",
     * or "USER" by their display name.
     * </p>
     *
     * @param name the name of the role to retrieve
     * @return an {@link Optional} containing the found {@link Role} or empty if not found
     * @since v.0.1
     */
    Optional<Role> findByName(String name);
}