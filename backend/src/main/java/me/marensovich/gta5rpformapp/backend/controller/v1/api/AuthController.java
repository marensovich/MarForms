package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.dto.auth.AuthResponse;
import me.marensovich.gta5rpformapp.backend.dto.auth.DiscordAuthRequest;
import me.marensovich.gta5rpformapp.backend.services.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/discord")
    public AuthResponse login(@RequestBody DiscordAuthRequest request) {

        String jwt = authService.loginWithDiscordManual(
                request.discordId(),
                request.username()
        );

        return new AuthResponse(jwt);
    }


    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        Cookie cookie = new Cookie("jwt", null);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
        return ResponseEntity.status(HttpStatus.OK).body(Map.of("message", "Logout Successful!"));
    }


}