package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.data.guilds.PlanTier;
import me.marensovich.gta5rpformapp.backend.service.billing.BillingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Subscriptions (E4.2): status, Stripe Checkout and Billing Portal for a
 * guild's owner, and Stripe's webhook endpoint.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@RestController
@RequiredArgsConstructor
public class BillingController {

    private final BillingService billingService;

    /**
     * A plan to buy.
     *
     * @param plan the tier
     */
    public record CheckoutRequest(PlanTier plan) {
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @GetMapping("/api/v1/guilds/{guildId}/billing")
    public BillingService.BillingStatus status(@PathVariable Long guildId) {
        return billingService.status(guildId);
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @PostMapping("/api/v1/guilds/{guildId}/billing/checkout")
    public Map<String, String> checkout(@PathVariable Long guildId, @RequestBody CheckoutRequest request) {
        if (request == null || request.plan() == null) throw new IllegalArgumentException("Choose a plan");
        return Map.of("url", billingService.checkout(guildId, request.plan()));
    }

    @PreAuthorize("@guildAccess.hasRole(#guildId, 'OWNER')")
    @PostMapping("/api/v1/guilds/{guildId}/billing/portal")
    public Map<String, String> portal(@PathVariable Long guildId) {
        return Map.of("url", billingService.portal(guildId));
    }

    /**
     * Stripe's webhook endpoint (public; authenticated by its signature).
     *
     * @param payload   the raw body, needed byte-for-byte for the signature
     * @param signature the {@code Stripe-Signature} header
     * @return 200 when accepted (or already seen), 400 when the signature is invalid
     * @since v.0.1
     */
    @PostMapping("/api/v1/public/billing/stripe/webhook")
    public ResponseEntity<Void> webhook(@RequestBody String payload,
                                        @RequestHeader(value = "Stripe-Signature", required = false) String signature) {
        return billingService.acceptWebhook(payload, signature)
                ? ResponseEntity.ok().build()
                : ResponseEntity.badRequest().build();
    }
}
