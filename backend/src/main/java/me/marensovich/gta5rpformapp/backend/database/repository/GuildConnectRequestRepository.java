package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.GuildConnectRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Repository
public interface GuildConnectRequestRepository extends JpaRepository<GuildConnectRequest, String> {

    /**
     * Deletes a request, reporting whether this call removed it — so of two
     * concurrent callbacks with the same state only one wins.
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM GuildConnectRequest r WHERE r.nonceHash = :nonceHash")
    int consume(String nonceHash);

    @Modifying
    @Transactional
    @Query("DELETE FROM GuildConnectRequest r WHERE r.expiresAt < :now")
    int deleteExpired(LocalDateTime now);
}
