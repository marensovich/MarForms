package me.marensovich.gta5rpformapp.backend.config.security;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The staff re-check with Discord runs on a membership the guard loaded with
 * no session open (open-in-view is off): it used to touch the lazy user and
 * fail every owner request once the last check was stale. Deliberately not
 * {@code @Transactional}, so the request sees real transaction boundaries.
 */
@SpringBootTest
@AutoConfigureMockMvc
class StaffRecheckOutsideTransactionTest {

    private static final long GUILD = 9301L;

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

    @AfterEach
    void cleanUp() {
        guildMembershipRepository.deleteAll(guildMembershipRepository.findAllByGuild_DiscordGuildId(GUILD));
        guildRepository.deleteById(GUILD);
        userRepository.findByDiscordId(9301L).ifPresent(userRepository::delete);
    }

    @Test
    void anOwnerWhoseCheckIsStaleStillReachesTheirServer() throws Exception {
        Guild guild = new Guild();
        guild.setDiscordGuildId(GUILD);
        guild.setName("Guild");
        guild = guildRepository.save(guild);
        User owner = new User();
        owner.setDiscordId(9301L);
        owner.setDiscordUsername("owner");
        owner = userRepository.save(owner);
        GuildMembership m = new GuildMembership();
        m.setUser(owner);
        m.setGuild(guild);
        m.setRole(GuildRole.OWNER);
        // Never checked: the guard re-checks with Discord on this request.
        m.setStaffVerifiedAt(null);
        guildMembershipRepository.save(m);

        mvc.perform(get("/api/v1/guilds/{g}/forms", GUILD)
                        .header("Authorization", "Bearer " + jwtUtil.generateToken(owner.getDiscordId())))
                .andExpect(status().isOk());
    }
}
