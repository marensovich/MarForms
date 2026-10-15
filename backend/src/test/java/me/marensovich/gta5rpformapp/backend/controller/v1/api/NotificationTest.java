package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookHealth;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.service.FormService;
import me.marensovich.gta5rpformapp.backend.service.GuildService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The bell (#122): who is told what, and reading.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class NotificationTest {

    private static final long GUILD = 8801L;
    private static final String HOOK = "https://discord.com/api/webhooks/1/abc";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private GuildRepository guildRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private GuildMembershipRepository guildMembershipRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private FormService formService;
    @Autowired
    private GuildService guildService;

    private User owner;
    private User moderator;
    private Form form;

    @BeforeEach
    void setUp() {
        Guild guild = new Guild();
        guild.setDiscordGuildId(GUILD);
        guild.setName("Los Santos RP");
        guild = guildRepository.save(guild);
        owner = user(81L, "owner", guild, GuildRole.OWNER);
        moderator = user(82L, "mod", guild, GuildRole.MODERATOR);

        FormSchema schema = new FormSchema();
        schema.setTitle("Набор в LSPD");
        WebhookConfig hook = new WebhookConfig();
        hook.setUrl(HOOK);
        form = new Form();
        form.setServerId(GUILD);
        form.setSchema(schema);
        form.setStatus(FormStatus.PUBLISHED);
        form.setAccessMode(FormAccessMode.OPEN);
        form.setSlug("bell-form");
        form.setWebhooks(new ArrayList<>(List.of(hook)));
        form = formRepository.saveAndFlush(form);
    }

    @Test
    void aNewSubmissionRingsForTheServersStaff() throws Exception {
        mvc.perform(post("/api/v1/public/forms/{s}/submissions", "bell-form")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"answers\": {}}"))
                .andExpect(status().isCreated());

        for (User staff : List.of(owner, moderator)) {
            mvc.perform(as(staff, get("/api/v1/me/notifications/unread-count"))).andExpect(jsonPath("$.count").value(1));
        }
        String body = mvc.perform(as(moderator, get("/api/v1/me/notifications")))
                .andExpect(jsonPath("$.content[0].type").value("NEW_SUBMISSION"))
                .andExpect(jsonPath("$.content[0].params.form").value("Набор в LSPD"))
                .andExpect(jsonPath("$.content[0].link").value(org.hamcrest.Matchers.startsWith("/dashboard/servers/" + GUILD + "/submissions?submission=")))
                .andReturn().getResponse().getContentAsString();
        String id = objectMapper.readTree(body).at("/content/0/id").asText();

        // Nobody else reads it; the moderator does.
        mvc.perform(as(owner, post("/api/v1/me/notifications/{id}/read", id))).andExpect(status().isNotFound());
        mvc.perform(as(moderator, post("/api/v1/me/notifications/{id}/read", id))).andExpect(status().isNoContent());
        mvc.perform(as(moderator, get("/api/v1/me/notifications/unread-count"))).andExpect(jsonPath("$.count").value(0));
        mvc.perform(as(owner, post("/api/v1/me/notifications/read-all"))).andExpect(status().isNoContent());
        mvc.perform(as(owner, get("/api/v1/me/notifications").param("unread", "true")))
                .andExpect(jsonPath("$.page.totalElements").value(0));
    }

    @Test
    void aBrokenWebhookAndARemovedBotRingForTheOwnerOnly() throws Exception {
        formService.updateWebhookHealth(form.getId(), HOOK, WebhookHealth.INVALID, WebhookHealth.REASON_WEBHOOK_DELETED, null);
        // Still broken: no second notification.
        formService.updateWebhookHealth(form.getId(), HOOK, WebhookHealth.INVALID, WebhookHealth.REASON_CHANNEL_UNAVAILABLE, null);
        guildService.markKicked(GUILD);

        mvc.perform(as(owner, get("/api/v1/me/notifications")))
                .andExpect(jsonPath("$.page.totalElements").value(2))
                .andExpect(jsonPath("$.content[*].type").value(org.hamcrest.Matchers.containsInAnyOrder("WEBHOOK_PROBLEM", "BOT_REMOVED")));
        mvc.perform(as(moderator, get("/api/v1/me/notifications/unread-count"))).andExpect(jsonPath("$.count").value(0));
    }

    private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId()));
    }

    private User user(long id, String name, Guild guild, GuildRole role) {
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
}
