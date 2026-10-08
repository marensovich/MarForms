package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.DiscordTokenSet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository interface for accessing {@link DiscordTokenSet} entities.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Repository
public interface DiscordTokenSetRepository extends JpaRepository<DiscordTokenSet, Long> {

    /**
     * Token sets that still have a refresh token and whose access token
     * expires before the given moment — the planned-refresh candidates.
     *
     * @param before the expiry cut-off
     * @return the matching token sets
     * @since v.0.1
     */
    List<DiscordTokenSet> findAllByRefreshTokenEncryptedIsNotNullAndExpiresAtBefore(LocalDateTime before);
}
