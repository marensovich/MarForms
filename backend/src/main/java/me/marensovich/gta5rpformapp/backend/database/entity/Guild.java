package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildBotStatus;
import me.marensovich.gta5rpformapp.backend.data.guilds.PlanTier;

import java.time.LocalDateTime;

/**
 * Entity representing a Discord server (guild) that has the bot installed.
 * <p>
 * The primary key is the Discord guild snowflake ID itself — a Guild row
 * only ever exists because a real Discord server has it, so there is no
 * need for a separate surrogate identifier.
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Entity
@Data
@Table(name = "guilds")
public class Guild {

    /**
     * The Discord guild snowflake ID.
     *
     * @since v.0.1
     */
    @Id
    @Column(name = "discord_guild_id", updatable = false, nullable = false)
    private Long discordGuildId;

    /**
     * The server's display name, as reported by Discord.
     *
     * @since v.0.1
     */
    @Column(nullable = false)
    private String name;

    /**
     * The server's icon hash, as reported by Discord (nullable — not every
     * server has a custom icon).
     *
     * @since v.0.1
     */
    private String iconHash;

    /**
     * Whether the bot currently has access to this server.
     *
     * @see GuildBotStatus
     * @since v.0.1
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private GuildBotStatus botStatus = GuildBotStatus.CONNECTED;

    /**
     * Billing tier — see {@link PlanTier}.
     *
     * @since v.0.1
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PlanTier planTier = PlanTier.FREE;

    /**
     * When the bot was (most recently) added to this server.
     *
     * @since v.0.1
     */
    @Column(nullable = false, updatable = false)
    private LocalDateTime connectedAt = LocalDateTime.now();
}
