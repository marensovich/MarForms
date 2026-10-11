package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * A pending "Add to Discord" bot install: the one-time state the install
 * link carries, stored only as a hash (security audit, #103).
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Entity
@Data
@Table(name = "guild_connect_requests")
public class GuildConnectRequest {

    /** SHA-256 (hex) of the nonce sent as OAuth {@code state}. */
    @Id
    @Column(name = "nonce_hash", length = 64, nullable = false, updatable = false)
    private String nonceHash;

    /** Who started the install — the user who becomes the guild's owner. */
    @Column(name = "discord_id", nullable = false, updatable = false)
    private Long discordId;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private LocalDateTime expiresAt;
}
