package me.marensovich.gta5rpformapp.backend.dto.search;

import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Results of the ⌘K search ({@code GET /api/v1/search}, #107): at most a few
 * hits per type, each only from what the caller may open.
 *
 * @param forms       forms by title or slug
 * @param submissions submissions by author nick or Discord ID
 * @param users       platform users by nick or Discord ID (USERS_MODERATE only)
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record SearchResultsDto(List<FormHit> forms, List<SubmissionHit> submissions, List<UserHit> users) {

    /**
     * @param workspace {@code true} if the caller is staff of the form's server,
     *                  so it opens in the server workspace; otherwise in the admin section
     */
    public record FormHit(UUID id, String title, String slug, FormStatus status,
                          String guildId, String guildName, boolean workspace) {
    }

    /**
     * @param workspace as in {@link FormHit}: opens in the server's moderation queue
     */
    public record SubmissionHit(UUID id, UUID formId, String formTitle, String guildId, String guildName,
                                String authorDiscordId, String authorName, SubmissionStatus status,
                                LocalDateTime createdAt, boolean workspace) {
    }

    public record UserHit(String discordId, String username, String avatarUrl) {
    }
}
