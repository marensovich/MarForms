package me.marensovich.gta5rpformapp.backend.dto.guild;

import java.util.List;

/**
 * A server's own settings (2026-10-19).
 *
 * @param adminRoles          roles whose holders own the server in MarForms
 * @param responsesChannel    #ответы, {@code null} if there is none
 * @param auditChannel        #аудит, {@code null} if there is none
 * @param canCreateChannels   the bot has Manage Channels on the server
 * @param channelAccessUpdated after a change of admin roles: whether the log
 *                            channels followed it; {@code null} otherwise
 */
public record GuildSettingsDto(List<Role> adminRoles, Channel responsesChannel, Channel auditChannel,
                               boolean canCreateChannels, Boolean channelAccessUpdated) {

    /** An admin role; {@code missing} if it was deleted in Discord. */
    public record Role(String id, String name, int color, boolean missing) {
    }

    /** A log channel; {@code name} is {@code null} if the bot can't see it now. */
    public record Channel(String id, String name) {
    }
}
