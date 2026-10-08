package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end through the real security chain (JWT filter + {@code @PreAuthorize}
 * + the {@code guildAccess} guard) — proves the SpEL expressions resolve
 * {@code #guildId} and reach the guard, not just that the guard's logic is right.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class GuildModeratorControllerTest {

    private static final long GUILD = 8001L;

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

    private Guild guild;

    @BeforeEach
    void setUp() {
        guild = new Guild();
        guild.setDiscordGuildId(GUILD);
        guild.setName("Test Guild");
        guild = guildRepository.save(guild);
    }

    private User user(long discordId, String name, GuildRole role) {
        User user = new User();
        user.setDiscordId(discordId);
        user.setDiscordUsername(name);
        user = userRepository.save(user);
        if (role != null) {
            GuildMembership membership = new GuildMembership();
            membership.setUser(user);
            membership.setGuild(guild);
            membership.setRole(role);
            guildMembershipRepository.save(membership);
        }
        return user;
    }

    private String bearer(User user) {
        return "Bearer " + jwtUtil.generateToken(user.getDiscordId());
    }

    @Test
    void ownerCanListModerators() throws Exception {
        User owner = user(1L, "owner", GuildRole.OWNER);
        user(2L, "mod", GuildRole.MODERATOR);

        mvc.perform(get("/api/v1/guilds/{g}/moderators", GUILD).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].discordId").value("2"))
                .andExpect(jsonPath("$[0].username").value("mod"));
    }

    @Test
    void moderatorsRespondentsAndOutsidersAreForbidden() throws Exception {
        User mod = user(2L, "mod", GuildRole.MODERATOR);
        User respondent = user(3L, "resp", GuildRole.RESPONDENT);
        User outsider = user(4L, "outsider", null);

        for (User u : new User[]{mod, respondent, outsider}) {
            mvc.perform(get("/api/v1/guilds/{g}/moderators", GUILD).header("Authorization", bearer(u)))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void ownerAddsAndRemovesAModerator() throws Exception {
        User owner = user(1L, "owner", GuildRole.OWNER);
        user(5L, "newmod", null);

        mvc.perform(post("/api/v1/guilds/{g}/moderators", GUILD).header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"NewMod\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.discordId").value("5"));

        mvc.perform(delete("/api/v1/guilds/{g}/moderators/{u}", GUILD, 5L).header("Authorization", bearer(owner)))
                .andExpect(status().isNoContent());

        mvc.perform(delete("/api/v1/guilds/{g}/moderators/{u}", GUILD, 5L).header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void theOwnerCannotBeMadeAModerator() throws Exception {
        User owner = user(1L, "owner", GuildRole.OWNER);

        mvc.perform(post("/api/v1/guilds/{g}/moderators", GUILD).header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"discordId\":\"1\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void addingAnUnknownUserIsNotFound() throws Exception {
        User owner = user(1L, "owner", GuildRole.OWNER);

        mvc.perform(post("/api/v1/guilds/{g}/moderators", GUILD).header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"discordId\":\"999\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void aModeratorCannotAppointOtherModerators() throws Exception {
        User mod = user(2L, "mod", GuildRole.MODERATOR);
        user(5L, "other", null);

        mvc.perform(post("/api/v1/guilds/{g}/moderators", GUILD).header("Authorization", bearer(mod))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"discordId\":\"5\"}"))
                .andExpect(status().isForbidden());
    }
}
