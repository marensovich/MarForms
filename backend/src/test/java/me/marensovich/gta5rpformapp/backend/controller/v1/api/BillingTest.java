package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.data.guilds.PlanTier;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.OutboundJobRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.service.billing.BillingService;
import me.marensovich.gta5rpformapp.backend.service.billing.StripeClient;
import me.marensovich.gta5rpformapp.backend.service.billing.StripeEventProcessor;
import me.marensovich.gta5rpformapp.backend.service.billing.StripeWebhookVerifier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Stripe billing (E4.2): checkout for the workspace, signed webhooks
 * applied once, and the guild's plan following the subscription.
 */
@SpringBootTest(properties = {
        "app.stripe.secret-key=sk_test_dummy",
        "app.stripe.webhook-secret=whsec_test",
        "app.stripe.prices.PRO=price_pro",
})
@AutoConfigureMockMvc
@Transactional
class BillingTest {

    private static final long GUILD = 8601L;
    private static final String SECRET = "whsec_test";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private GuildRepository guildRepository;
    @Autowired
    private GuildMembershipRepository guildMembershipRepository;
    @Autowired
    private OutboundJobRepository outboundJobRepository;
    @Autowired
    private StripeEventProcessor stripeEventProcessor;

    @MockitoBean
    private StripeClient stripeClient;

    private User owner;
    private User moderator;

    @BeforeEach
    void setUp() {
        Guild guild = new Guild();
        guild.setDiscordGuildId(GUILD);
        guild.setName("Guild");
        guild = guildRepository.save(guild);
        owner = member(1L, "owner", guild, GuildRole.OWNER);
        moderator = member(2L, "mod", guild, GuildRole.MODERATOR);
        when(stripeClient.createCustomer(anyString(), anyString())).thenReturn("cus_1");
        when(stripeClient.createCheckoutSession(anyString(), anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn("https://checkout.stripe.test/s/1");
        when(stripeClient.createPortalSession(anyString(), anyString())).thenReturn("https://billing.stripe.test/p/1");
    }

    private User member(long id, String name, Guild guild, GuildRole role) {
        User u = new User();
        u.setDiscordId(id);
        u.setDiscordUsername(name);
        u = userRepository.save(u);
        GuildMembership m = new GuildMembership();
        m.setUser(u);
        m.setGuild(guild);
        m.setRole(role);
        guildMembershipRepository.save(m);
        return u;
    }

    private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId()))
                .contentType(MediaType.APPLICATION_JSON);
    }

    private String workspaceId() throws Exception {
        String body = mvc.perform(as(owner, get("/api/v1/guilds/{g}/billing", GUILD)))
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("workspaceId").asText();
    }

    private MockHttpServletRequestBuilder webhook(String eventId, String type, long created, Map<String, Object> object)
            throws Exception {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("id", eventId);
        event.put("type", type);
        event.put("created", created);
        event.put("data", Map.of("object", object));
        String payload = objectMapper.writeValueAsString(event);
        long t = Instant.now().getEpochSecond();
        return post("/api/v1/public/billing/stripe/webhook").contentType(MediaType.APPLICATION_JSON).content(payload)
                .header("Stripe-Signature", "t=" + t + ",v1=" + StripeWebhookVerifier.sign(t + "." + payload, SECRET));
    }

    private Map<String, Object> subscription(String workspaceId, String status, boolean cancelAtPeriodEnd) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("id", "sub_1");
        s.put("customer", "cus_1");
        s.put("status", status);
        s.put("cancel_at_period_end", cancelAtPeriodEnd);
        s.put("metadata", Map.of("workspaceId", workspaceId, "plan", "PRO"));
        s.put("items", Map.of("data", List.of(Map.of("current_period_end", 1_900_000_000L,
                "price", Map.of("id", "price_pro")))));
        return s;
    }

    private PlanTier plan() {
        return guildRepository.findById(GUILD).orElseThrow().getPlanTier();
    }

    @Test
    void theOwnerChecksOutAndTheGuildFollowsTheSubscription() throws Exception {
        mvc.perform(as(owner, get("/api/v1/guilds/{g}/billing", GUILD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan").value("FREE"))
                .andExpect(jsonPath("$.status").value("none"))
                .andExpect(jsonPath("$.billingEnabled").value(true))
                .andExpect(jsonPath("$.availablePlans[0]").value("PRO"))
                .andExpect(jsonPath("$.guildCount").value(1));
        String ws = workspaceId();

        mvc.perform(as(owner, post("/api/v1/guilds/{g}/billing/checkout", GUILD)).content("{\"plan\": \"PRO\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("https://checkout.stripe.test/s/1"));
        verify(stripeClient).createCheckoutSession(eq("cus_1"), eq("price_pro"), eq(ws), eq("PRO"), anyString(), anyString());

        long t0 = Instant.now().getEpochSecond();
        mvc.perform(webhook("evt_1", "customer.subscription.created", t0, subscription(ws, "active", false)))
                .andExpect(status().isOk());
        // Stripe redelivers: acknowledged, not queued twice.
        mvc.perform(webhook("evt_1", "customer.subscription.created", t0, subscription(ws, "active", false)))
                .andExpect(status().isOk());
        assertThat(outboundJobRepository.findAll().stream()
                .filter(j -> j.getJobType().equals(BillingService.JOB_TYPE_STRIPE_EVENT)).count()).isEqualTo(1);

        stripeEventProcessor.processDueEvents();
        assertThat(plan()).isEqualTo(PlanTier.PRO);
        mvc.perform(as(owner, get("/api/v1/guilds/{g}/billing", GUILD)))
                .andExpect(jsonPath("$.plan").value("PRO"))
                .andExpect(jsonPath("$.status").value("active"))
                .andExpect(jsonPath("$.currentPeriodEnd").exists());

        // Already subscribed: checkout again is refused, the portal works.
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/billing/checkout", GUILD)).content("{\"plan\": \"PRO\"}"))
                .andExpect(status().isConflict());
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/billing/portal", GUILD)))
                .andExpect(jsonPath("$.url").value("https://billing.stripe.test/p/1"));

        // Cancelling keeps the plan until the period ends...
        mvc.perform(webhook("evt_2", "customer.subscription.updated", t0 + 10, subscription(ws, "active", true)))
                .andExpect(status().isOk());
        stripeEventProcessor.processDueEvents();
        assertThat(plan()).isEqualTo(PlanTier.PRO);

        // ...an older event delivered late changes nothing...
        mvc.perform(webhook("evt_0", "customer.subscription.updated", t0 - 100, subscription(ws, "canceled", false)))
                .andExpect(status().isOk());
        stripeEventProcessor.processDueEvents();
        assertThat(plan()).isEqualTo(PlanTier.PRO);

        // ...and when Stripe ends it, the guild is back on FREE.
        mvc.perform(webhook("evt_3", "customer.subscription.deleted", t0 + 20, subscription(ws, "canceled", true)))
                .andExpect(status().isOk());
        stripeEventProcessor.processDueEvents();
        assertThat(plan()).isEqualTo(PlanTier.FREE);
        verify(stripeClient, times(1)).createCustomer(anyString(), any());
    }

    @Test
    void unsignedWebhooksAndNonOwnersAreRejected() throws Exception {
        mvc.perform(post("/api/v1/public/billing/stripe/webhook").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"evt_x\",\"type\":\"customer.subscription.created\"}")
                        .header("Stripe-Signature", "t=1,v1=deadbeef"))
                .andExpect(status().isBadRequest());
        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/billing", GUILD))).andExpect(status().isForbidden());
        mvc.perform(as(moderator, post("/api/v1/guilds/{g}/billing/checkout", GUILD)).content("{\"plan\": \"PRO\"}"))
                .andExpect(status().isForbidden());
    }
}
