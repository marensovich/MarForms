package me.marensovich.gta5rpformapp.backend.data.guilds;

/**
 * Billing tier of a {@link me.marensovich.gta5rpformapp.backend.database.entity.Guild}.
 * <p>
 * What each tier allows is configuration, not code ({@code app.plans.limits.*},
 * see {@code PlanLimitService}, E4.1): the price grid (spec раздел 7) can
 * change without a release. Stored as text, so adding a tier needs no
 * migration.
 * </p>
 *
 * @since v.0.1
 */
public enum PlanTier {
    FREE,
    PRO
}
