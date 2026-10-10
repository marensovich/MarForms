package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Which workspace a guild belongs to: exactly one (ADR 0004).
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "workspace_guilds")
public class WorkspaceGuild {

    /**
     * The guild's Discord snowflake ID.
     */
    @Id
    @Column(name = "guild_id", nullable = false)
    private Long guildId;

    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;
}
