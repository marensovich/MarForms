package me.marensovich.gta5rpformapp.backend.services;

import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserService userService;
    private final JwtUtil jwtUtil;

    public String loginWithDiscord(OAuth2User oauthUser) {

        Long discordId = Long.parseLong(oauthUser.getAttribute("id"));
        String username = oauthUser.getAttribute("username");

        User user = userService.findOrCreateDiscordUser(discordId, username);

        return jwtUtil.generateToken(user.getDiscordId());
    }

    public String loginWithDiscordManual(Long discordId, String username) {

        User user = userService.findOrCreateDiscordUser(discordId, username);

        return jwtUtil.generateToken(user.getDiscordId());
    }
}