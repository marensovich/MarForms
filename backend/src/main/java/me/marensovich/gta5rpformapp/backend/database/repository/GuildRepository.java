package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Repository interface for accessing {@link Guild} entities in the database.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Repository
public interface GuildRepository extends JpaRepository<Guild, Long> {
}
