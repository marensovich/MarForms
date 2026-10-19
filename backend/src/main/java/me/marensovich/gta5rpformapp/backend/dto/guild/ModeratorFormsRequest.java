package me.marensovich.gta5rpformapp.backend.dto.guild;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Set;
import java.util.UUID;

/**
 * Which forms of a server a moderator works with (#18, #91).
 *
 * @param restricted {@code false} = every form of the server (the default);
 *                   {@code true} = only {@code formIds}, none if it is empty
 * @param formIds    the server's forms, when restricted
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public record ModeratorFormsRequest(boolean restricted, @NotNull @Size(max = 500) Set<UUID> formIds) {
}
