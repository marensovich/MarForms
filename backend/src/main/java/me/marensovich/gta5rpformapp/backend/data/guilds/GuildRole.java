package me.marensovich.gta5rpformapp.backend.data.guilds;

/**
 * A user's role within a single {@link me.marensovich.gta5rpformapp.backend.database.entity.Guild}.
 * <p>
 * Distinct from the global {@link me.marensovich.gta5rpformapp.backend.database.entity.Role}
 * RBAC used for platform-admin access — this is scoped per guild, so the
 * same user can be {@code OWNER} on one server and {@code RESPONDENT} on another.
 * </p>
 *
 * @since v.0.1
 */
public enum GuildRole {
    OWNER,
    MODERATOR,
    RESPONDENT
}
