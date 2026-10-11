package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.LoginCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Repository
public interface LoginCodeRepository extends JpaRepository<LoginCode, String> {

    /** Deletes a code, reporting whether this call removed it (single use under concurrency). */
    @Modifying
    @Transactional
    @Query("DELETE FROM LoginCode c WHERE c.codeHash = :codeHash")
    int consume(String codeHash);

    @Modifying
    @Transactional
    @Query("DELETE FROM LoginCode c WHERE c.expiresAt < :now")
    int deleteExpired(LocalDateTime now);
}
