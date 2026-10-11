package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Deliberately not {@code @Transactional}: a test-wide transaction would keep
 * the persistence context open and hide lazy-loading failures (#103).
 */
@SpringBootTest
@AutoConfigureMockMvc
class MeEndpointsTest {

    private static final long GUILD = 9401L;

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private GuildRepository guildRepository;
    @Autowired
    private GuildMembershipRepository guildMembershipRepository;

    private User user;
    private GuildMembership membership;

    @BeforeEach
    void setUp() {
        Guild guild = new Guild();
        guild.setDiscordGuildId(GUILD);
        guild.setName("Lazy Guild");
        guildRepository.save(guild);
        user = new User();
        user.setDiscordId(9402L);
        user.setDiscordUsername("me");
        user = userRepository.save(user);
        membership = new GuildMembership();
        membership.setUser(user);
        membership.setGuild(guild);
        membership.setRole(GuildRole.OWNER);
        membership = guildMembershipRepository.save(membership);
    }

    @AfterEach
    void tearDown() {
        guildMembershipRepository.delete(membership);
        userRepository.delete(user);
        guildRepository.deleteById(GUILD);
    }

    @Test
    void myGuildsLoadsOutsideATransaction() throws Exception {
        mvc.perform(get("/api/v1/me/guilds").header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].guildName").value("Lazy Guild"));
    }

    @Test
    void theApiAnswers401InsteadOfRedirectingToLogin() throws Exception {
        mvc.perform(get("/api/v1/me")).andExpect(status().isUnauthorized());
    }
}
