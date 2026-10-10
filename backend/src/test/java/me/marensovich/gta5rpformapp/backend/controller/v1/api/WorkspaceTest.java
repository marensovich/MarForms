package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.data.guilds.PlanTier;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.Subscription;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubscriptionRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.service.billing.WorkspaceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * One owner, one subscription, several servers (E4.3).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class WorkspaceTest {

    private static final long PAID = 8701L;
    private static final long SECOND = 8702L;
    private static final long OWN_SUB = 8703L;
    private static final long FOREIGN = 8704L;

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
    @Autowired
    private SubscriptionRepository subscriptionRepository;
    @Autowired
    private WorkspaceService workspaceService;

    private User owner;

    private void guild(long id, User user, GuildRole role) {
        Guild g = new Guild();
        g.setDiscordGuildId(id);
        g.setName("Guild " + id);
        g = guildRepository.save(g);
        GuildMembership m = new GuildMembership();
        m.setUser(user);
        m.setGuild(g);
        m.setRole(role);
        guildMembershipRepository.save(m);
    }

    private void activeSubscription(long guildId) {
        UUID ws = workspaceService.forGuild(guildId).getId();
        Subscription s = new Subscription();
        s.setWorkspaceId(ws);
        s.setPlanTier(PlanTier.PRO);
        s.setStatus("active");
        s.setStripeCustomerId("cus_" + guildId);
        subscriptionRepository.save(s);
        workspaceService.applyPlan(ws, PlanTier.PRO);
    }

    private PlanTier plan(long guildId) {
        return guildRepository.findById(guildId).orElseThrow().getPlanTier();
    }

    private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId()))
                .contentType(MediaType.APPLICATION_JSON);
    }

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setDiscordId(1L);
        owner.setDiscordUsername("owner");
        owner = userRepository.save(owner);
        User stranger = new User();
        stranger.setDiscordId(2L);
        stranger.setDiscordUsername("stranger");
        stranger = userRepository.save(stranger);

        guild(PAID, owner, GuildRole.OWNER);
        guild(SECOND, owner, GuildRole.OWNER);
        guild(OWN_SUB, owner, GuildRole.OWNER);
        guild(FOREIGN, stranger, GuildRole.OWNER);
        activeSubscription(PAID);
        activeSubscription(OWN_SUB);
    }

    @Test
    void aServerJoinsAnotherServersSubscriptionAndCanLeaveIt() throws Exception {
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/workspace/join", SECOND)).content("{\"targetGuildId\": " + PAID + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan").value("PRO"))
                .andExpect(jsonPath("$.guildCount").value(2))
                .andExpect(jsonPath("$.guilds[1].guildId").exists());
        assertThat(plan(SECOND)).isEqualTo(PlanTier.PRO);
        assertThat(workspaceService.forGuild(SECOND).getId()).isEqualTo(workspaceService.forGuild(PAID).getId());

        mvc.perform(as(owner, post("/api/v1/guilds/{g}/workspace/leave", SECOND)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan").value("FREE"))
                .andExpect(jsonPath("$.guildCount").value(1));
        assertThat(plan(SECOND)).isEqualTo(PlanTier.FREE);
        assertThat(plan(PAID)).isEqualTo(PlanTier.PRO);

        // Alone again: nothing to leave.
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/workspace/leave", SECOND))).andExpect(status().isConflict());
    }

    @Test
    void aServerPayingOnItsOwnOrSomeoneElsesServerCantBeMerged() throws Exception {
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/workspace/join", OWN_SUB)).content("{\"targetGuildId\": " + PAID + "}"))
                .andExpect(status().isConflict());
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/workspace/join", SECOND)).content("{\"targetGuildId\": " + FOREIGN + "}"))
                .andExpect(status().isForbidden());
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/workspace/join", FOREIGN)).content("{\"targetGuildId\": " + PAID + "}"))
                .andExpect(status().isForbidden());
    }
}
