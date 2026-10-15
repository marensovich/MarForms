package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.data.guilds.GuildBotStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository interface for accessing {@link Guild} entities in the database.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Repository
public interface GuildRepository extends JpaRepository<Guild, Long> {

    /**
     * Locks the server's row: submissions to its forms take numbers one at a time (#114).
     *
     * @param discordGuildId the server
     * @return the locked server, if the platform knows it
     * @since v.0.1
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from Guild g where g.discordGuildId = :discordGuildId")
    Optional<Guild> lockById(Long discordGuildId);

    /**
     * Finds all guilds currently in the given bot-connection status.
     *
     * @param botStatus the status to filter by
     * @return matching guilds
     * @since v.0.1
     */
    List<Guild> findAllByBotStatus(GuildBotStatus botStatus);
}
