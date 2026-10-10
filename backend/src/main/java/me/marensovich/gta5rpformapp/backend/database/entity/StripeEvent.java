package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * A Stripe webhook event already accepted, so a redelivery is not applied
 * twice (E4.2).
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "stripe_events")
public class StripeEvent {

    @Id
    @Column(name = "event_id", length = 100)
    private String eventId;

    @Column(nullable = false, length = 100)
    private String type;

    @Column(name = "received_at", nullable = false)
    private LocalDateTime receivedAt;
}
