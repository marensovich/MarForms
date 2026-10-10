package me.marensovich.gta5rpformapp.backend.database.entity;

import jakarta.persistence.*;
import lombok.Data;
import me.marensovich.gta5rpformapp.backend.data.guilds.PlanTier;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A workspace's subscription, mirrored from Stripe by its webhooks (E4.2).
 * Stripe is the source of truth; this row is what the app needs to decide
 * the plan without calling Stripe.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Entity
@Data
@Table(name = "subscriptions")
public class Subscription {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "workspace_id", nullable = false, unique = true)
    private UUID workspaceId;

    /**
     * The tier this subscription pays for.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "plan_tier", nullable = false, length = 20)
    private PlanTier planTier;

    @Column(name = "stripe_customer_id", length = 100)
    private String stripeCustomerId;

    @Column(name = "stripe_subscription_id", length = 100, unique = true)
    private String stripeSubscriptionId;

    /**
     * Stripe's subscription status ({@code active}, {@code past_due},
     * {@code canceled}, ...), or {@code none} before the first checkout.
     */
    @Column(nullable = false, length = 30)
    private String status;

    @Column(name = "current_period_end")
    private LocalDateTime currentPeriodEnd;

    @Column(name = "cancel_at_period_end", nullable = false)
    private boolean cancelAtPeriodEnd;

    /**
     * When the newest applied Stripe event was created: older events,
     * delivered late, are ignored.
     */
    @Column(name = "last_event_at")
    private LocalDateTime lastEventAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
}
