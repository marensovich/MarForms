package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "submission")
public class Submission {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID formId;

    private Long discordId;

    private LocalDateTime createdAt;

    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> answers;
}
