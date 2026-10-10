package me.marensovich.gta5rpformapp.backend.service.billing;

import me.marensovich.gta5rpformapp.backend.data.guilds.PlanTier;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.EnumMap;
import java.util.Map;

/**
 * Stripe settings (E4.2), from {@code app.stripe.*}. Billing is off until
 * a secret key and at least one price are set.
 *
 * @param secretKey     the API secret key ({@code sk_test_...} in test mode)
 * @param webhookSecret the webhook endpoint's signing secret ({@code whsec_...})
 * @param prices        the Stripe price id of each paid tier
 * @param apiBase       the API base URL (overridable for tests)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@ConfigurationProperties(prefix = "app.stripe")
public record StripeProperties(String secretKey, String webhookSecret, Map<PlanTier, String> prices, String apiBase) {

    public StripeProperties {
        EnumMap<PlanTier, String> copy = new EnumMap<>(PlanTier.class);
        if (prices != null) {
            prices.forEach((tier, price) -> {
                if (price != null && !price.isBlank()) copy.put(tier, price.trim());
            });
        }
        prices = copy;
        if (apiBase == null || apiBase.isBlank()) apiBase = "https://api.stripe.com";
    }

    /**
     * @return whether checkout can be offered at all
     */
    public boolean enabled() {
        return secretKey != null && !secretKey.isBlank() && !prices.isEmpty();
    }
}
