package me.marensovich.gta5rpformapp.backend.database.repository;

import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.FormReminder;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface FormReminderRepository extends JpaRepository<FormReminder, UUID> {

    boolean existsByFormIdAndDiscordId(UUID formId, Long discordId);

    /**
     * Unsent reminders of published forms whose opening time has come — read at
     * send time, so a moved {@code opensAt} is followed (#121).
     */
    @Query("""
            select r from FormReminder r, Form f
            where f.id = r.formId and r.sentAt is null
              and f.status = :status and f.opensAt is not null and f.opensAt <= :now
            order by r.createdAt""")
    List<FormReminder> findDue(FormStatus status, LocalDateTime now, Pageable page);

    /** For H2 and anywhere the database cascade doesn't run. */
    @Modifying
    @Transactional
    void deleteAllByFormId(UUID formId);
}
