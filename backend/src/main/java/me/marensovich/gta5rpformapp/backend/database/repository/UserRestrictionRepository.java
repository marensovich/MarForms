package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.UserRestriction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * The history of platform bans and time-outs (#144).
 */
public interface UserRestrictionRepository extends JpaRepository<UserRestriction, UUID> {

    List<UserRestriction> findAllByUserDiscordIdOrderByCreatedAtDesc(Long userDiscordId);

    /** The restriction of this kind still in force (not lifted), the latest first. */
    Optional<UserRestriction> findFirstByUserDiscordIdAndTypeAndLiftedAtIsNullOrderByCreatedAtDesc(Long userDiscordId,
                                                                                                  UserRestriction.Type type);
}
