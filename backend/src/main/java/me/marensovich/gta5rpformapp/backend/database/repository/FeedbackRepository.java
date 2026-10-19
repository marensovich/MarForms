package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.Feedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.UUID;

public interface FeedbackRepository extends JpaRepository<Feedback, UUID> {

    /** How much one person sent since a moment — the hourly limit. */
    long countByAuthorDiscordIdAndCreatedAtAfter(Long authorDiscordId, LocalDateTime after);
}
