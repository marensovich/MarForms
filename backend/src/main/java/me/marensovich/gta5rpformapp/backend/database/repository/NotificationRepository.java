package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.database.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findAllByRecipientDiscordId(Long recipientDiscordId, Pageable pageable);

    Page<Notification> findAllByRecipientDiscordIdAndReadAtIsNull(Long recipientDiscordId, Pageable pageable);

    long countByRecipientDiscordIdAndReadAtIsNull(Long recipientDiscordId);

    Optional<Notification> findByIdAndRecipientDiscordId(UUID id, Long recipientDiscordId);

    @Modifying
    @Query("update Notification n set n.readAt = :now where n.recipientDiscordId = :recipient and n.readAt is null")
    int markAllRead(Long recipient, LocalDateTime now);

    @Modifying
    @Query("delete from Notification n where n.createdAt < :before")
    int deleteOlderThan(LocalDateTime before);
}
