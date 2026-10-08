package me.marensovich.gta5rpformapp.backend.dto.submission;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * The moderation card for one submission (task #55): the submission, the
 * form schema (to label answers) and the author's profile in the guild.
 *
 * @param submission the submission
 * @param formId     the form's ID
 * @param schema     the form's schema
 * @param author     the author's profile, {@code null} for a logged-out OPEN respondent
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record SubmissionDetailDto(
        SubmissionDto submission,
        UUID formId,
        FormSchema schema,
        Author author
) {
    /**
     * The submission's author as known to this guild.
     *
     * @param discordId       Discord ID (serialized as string)
     * @param username        Discord username, if they have logged in to MarForms
     * @param discordRoles    their roles on the guild (cached, see GuildMembership), named via the bot
     * @param rolesSyncedAt   when that role cache was refreshed, if ever
     * @param submissionCount how many submissions they made to this form
     */
    public record Author(
            @JsonSerialize(using = ToStringSerializer.class)
            Long discordId,
            String username,
            List<DiscordBotClient.DiscordRole> discordRoles,
            LocalDateTime rolesSyncedAt,
            long submissionCount
    ) {
    }
}
