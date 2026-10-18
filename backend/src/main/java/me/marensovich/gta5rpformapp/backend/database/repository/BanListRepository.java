package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.BanListEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BanListRepository extends JpaRepository<BanListEntry, UUID> {

    boolean existsByGuildIdAndDiscordId(Long guildId, Long discordId);

    Optional<BanListEntry> findByGuildIdAndDiscordId(Long guildId, Long discordId);

    List<BanListEntry> findAllByGuildIdOrderByCreatedAtDesc(Long guildId);

    /** The ban that applies now, if any: a lapsed one doesn't (#131). */
    default Optional<BanListEntry> findActive(Long guildId, Long discordId) {
        return findByGuildIdAndDiscordId(guildId, discordId).filter(BanListEntry::isActive);
    }
}
