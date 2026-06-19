package me.marensovich.gta5rpformapp.backend.dto.auth;

public record DiscordAuthRequest(
        Long discordId,
        String username
) {}