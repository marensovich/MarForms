package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class UserController {

    @GetMapping("/me")
    public Map<String, Object> me(Authentication auth) {

        return Map.of(
            "userId", auth.getPrincipal(),
            "authenticated", auth.isAuthenticated()
        );
    }
}