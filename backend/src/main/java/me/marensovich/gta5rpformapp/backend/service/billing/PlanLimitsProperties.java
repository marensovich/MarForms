package me.marensovich.gta5rpformapp.backend.service.billing;

import me.marensovich.gta5rpformapp.backend.data.guilds.PlanTier;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.EnumMap;
import java.util.Map;

/**
 * Limits per plan (E4.1, #93), from {@code app.plans.limits.<TIER>.<metric>}:
 * <pre>
 * app.plans.limits.FREE.active-forms=5
 * app.plans.limits.FREE.submissions-per-month=1000
 * app.plans.limits.FREE.moderators=3
 * </pre>
 * A limit that isn't set is unlimited, so a tier with nothing configured
 * (and every tier, until the price grid is decided) limits nothing.
 *
 * @param limits the limits of each tier
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@ConfigurationProperties(prefix = "app.plans")
public record PlanLimitsProperties(Map<PlanTier, Limits> limits) {

    public PlanLimitsProperties {
        EnumMap<PlanTier, Limits> copy = new EnumMap<>(PlanTier.class);
        if (limits != null) copy.putAll(limits);
        limits = copy;
    }

    /**
     * One tier's limits; {@code null} = unlimited.
     *
     * @param activeForms         forms not archived
     * @param submissionsPerMonth submissions to all the guild's forms this calendar month (server time, like submission timestamps)
     * @param moderators          moderators (the owner not counted)
     */
    public record Limits(Integer activeForms, Integer submissionsPerMonth, Integer moderators) {
    }

    /**
     * @param tier a plan tier
     * @return its limits; all unlimited if none are configured
     */
    public Limits of(PlanTier tier) {
        return limits.getOrDefault(tier, new Limits(null, null, null));
    }
}
