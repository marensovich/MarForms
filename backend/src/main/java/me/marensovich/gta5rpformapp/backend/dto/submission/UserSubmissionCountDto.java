package me.marensovich.gta5rpformapp.backend.dto.submission;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

/**
 * Data Transfer Object representing the number of submissions made by a user.
 * <p>
 * Used for displaying user activity statistics, leaderboards, and administrative
 * dashboards. Shows how many total submissions each user has made across all forms.
 * </p>
 *
 * @param discordId the Discord ID of the user (serialized as string)
 * @param count     the total number of submissions made by the user
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record UserSubmissionCountDto(
        @JsonSerialize(using = ToStringSerializer.class)
        Long discordId,
        Long count
) {
}