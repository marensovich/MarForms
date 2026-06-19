package me.marensovich.gta5rpformapp.backend.services;

import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User findOrCreateDiscordUser(Long discordId, String username) {
        return userRepository.findByDiscordId(discordId)
                .orElseGet(() -> {
                    User user = new User();
                    user.setDiscordId(discordId);
                    user.setDiscordUsername(username);
                    user.setRoles(Set.of());
                    return userRepository.save(user);
                });
    }

}
