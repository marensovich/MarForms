package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * A one-time sign-in code handed to the browser after Discord OAuth, in place
 * of the JWT (#103). Only hashes of the code and of the browser-binding
 * cookie are stored.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Entity
@Data
@Table(name = "login_codes")
public class LoginCode {

    @Id
    @Column(name = "code_hash", length = 64, nullable = false, updatable = false)
    private String codeHash;

    @Column(name = "nonce_hash", length = 64, nullable = false, updatable = false)
    private String nonceHash;

    @Column(name = "discord_id", nullable = false, updatable = false)
    private Long discordId;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private LocalDateTime expiresAt;
}
