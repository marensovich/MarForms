package me.marensovich.gta5rpformapp.backend.data.guilds;

/**
 * Billing tier of a {@link me.marensovich.gta5rpformapp.backend.database.entity.Guild}.
 * <p>
 * Only {@code FREE} is meaningful today — the field exists so limits and
 * billing (see product spec раздел 7) can be layered on later without a
 * schema migration. No tier here enforces any limit yet.
 * </p>
 *
 * @since v.0.1
 */
public enum PlanTier {
    FREE
}
