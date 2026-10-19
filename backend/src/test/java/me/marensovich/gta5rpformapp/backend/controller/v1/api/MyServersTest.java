package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.forms.SubmissionStatus;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * «Мои серверы» (#124): counters, the bot's state, refreshing from Discord.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MyServersTest {

    private static final long GUILD = 9101L;

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private GuildRepository guildRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private GuildMembershipRepository guildMembershipRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private SubmissionRepository submissionRepository;
    @MockitoBean
    private DiscordBotClient botClient;
    @Autowired
    private me.marensovich.gta5rpformapp.backend.service.GuildService guildService;

    private User owner;

    @BeforeEach
    void setUp() {
        Guild guild = new Guild();
        guild.setDiscordGuildId(GUILD);
        guild.setName("Old name");
        guild = guildRepository.save(guild);
        owner = new User();
        owner.setDiscordId(91L);
        owner.setDiscordUsername("owner");
        owner = userRepository.save(owner);
        GuildMembership m = new GuildMembership();
        m.setUser(owner);
        m.setGuild(guild);
        m.setRole(GuildRole.OWNER);
        guildMembershipRepository.save(m);

        Form published = form("srv-a", FormStatus.PUBLISHED);
        form("srv-b", FormStatus.DRAFT);
        submission(published, SubmissionStatus.PENDING);
        submission(published, SubmissionStatus.APPROVED);
    }

    @Test
    void theCardCountsActiveFormsAndWaitingSubmissions() throws Exception {
        mvc.perform(as(get("/api/v1/me/guilds")))
                .andExpect(jsonPath("$[0].guildId").value(String.valueOf(GUILD)))
                .andExpect(jsonPath("$[0].role").value("OWNER"))
                .andExpect(jsonPath("$[0].botState").value("CONNECTED"))
                .andExpect(jsonPath("$[0].activeForms").value(1))
                .andExpect(jsonPath("$[0].pendingSubmissions").value(1));
    }

    @Test
    void refreshingReadsMembersAndMissingPermissionsOnceAMinute() throws Exception {
        when(botClient.isAvailable()).thenReturn(true);
        when(botClient.fetchGuildState(GUILD)).thenReturn(Optional.of(
                new DiscordBotClient.GuildState("Los Santos RP", null, 1240, List.of("MANAGE_WEBHOOKS"))));

        mvc.perform(as(post("/api/v1/me/guilds/refresh")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].guildName").value("Los Santos RP"))
                .andExpect(jsonPath("$[0].memberCount").value(1240))
                .andExpect(jsonPath("$[0].botState").value("MISSING_PERMISSIONS"))
                .andExpect(jsonPath("$[0].missingPermissions[0]").value("MANAGE_WEBHOOKS"));
        mvc.perform(as(post("/api/v1/me/guilds/refresh"))).andExpect(status().isTooManyRequests());
    }

    @Test
    void theInviteCanGoStraightToTheServerWithTheNeededPermissions() throws Exception {
        // FORMS_MANAGE isn't needed any more (#151), nor MANAGE_ROLES; VIEW_CHANNEL | MANAGE_WEBHOOKS.
        mvc.perform(as(get("/api/v1/guilds/connect").param("guildId", String.valueOf(GUILD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url", containsString("&permissions=603980816")))
                .andExpect(jsonPath("$.url", containsString("&guild_id=" + GUILD + "&disable_guild_select=true")));
    }

    @Test
    void aServerTheBotCantSeeIsMarkedRemoved() throws Exception {
        when(botClient.isAvailable()).thenReturn(true);
        when(botClient.fetchGuildState(GUILD)).thenReturn(Optional.empty());
        guildService.sync(GUILD);
        mvc.perform(as(get("/api/v1/me/guilds"))).andExpect(jsonPath("$[0].botState").value("KICKED"));
    }

    private MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwtUtil.generateToken(owner.getDiscordId()));
    }

    private Form form(String slug, FormStatus status) {
        FormSchema schema = new FormSchema();
        schema.setTitle(slug);
        Form f = new Form();
        f.setServerId(GUILD);
        f.setSchema(schema);
        f.setStatus(status);
        f.setSlug(slug);
        return formRepository.save(f);
    }

    private void submission(Form form, SubmissionStatus status) {
        Submission s = new Submission();
        s.setFormId(form.getId());
        s.setAnswers(Map.of());
        s.setStatus(status);
        submissionRepository.save(s);
    }
}
