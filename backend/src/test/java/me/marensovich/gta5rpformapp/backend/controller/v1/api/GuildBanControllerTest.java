package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Guild ban list (E2.2): CRUD by staff, and a banned respondent is turned
 * away from the public form and from submission intake.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class GuildBanControllerTest {

    private static final long GUILD = 8101L;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private me.marensovich.gta5rpformapp.backend.database.repository.BanListRepository banListRepository;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private GuildRepository guildRepository;
    @Autowired
    private GuildMembershipRepository guildMembershipRepository;
    @Autowired
    private FormRepository formRepository;

    private User owner;
    private User moderator;
    private User respondent;

    @BeforeEach
    void setUp() {
        Guild guild = new Guild();
        guild.setDiscordGuildId(GUILD);
        guild.setName("Guild");
        guildRepository.save(guild);

        owner = user(1L, "owner");
        membership(owner, guild, GuildRole.OWNER);
        moderator = user(2L, "mod");
        membership(moderator, guild, GuildRole.MODERATOR);
        respondent = user(3L, "spammer");
        membership(respondent, guild, GuildRole.RESPONDENT);
    }

    private User user(long discordId, String name) {
        User u = new User();
        u.setDiscordId(discordId);
        u.setDiscordUsername(name);
        u.setGuildIds(Set.of(GUILD));
        return userRepository.save(u);
    }

    private void membership(User user, Guild guild, GuildRole role) {
        GuildMembership m = new GuildMembership();
        m.setUser(user);
        m.setGuild(guild);
        m.setRole(role);
        guildMembershipRepository.save(m);
    }

    private void publishedForm(String slug) {
        FormField nick = new FormField();
        nick.setId("nick");
        nick.setType(FormField.FieldType.TEXT);
        nick.setLabel("Nickname");
        FormSchema schema = new FormSchema();
        schema.setTitle("Application");
        schema.setFields(new ArrayList<>(List.of(nick)));
        Form form = new Form();
        form.setServerId(GUILD);
        form.setSchema(schema);
        form.setAccessMode(FormAccessMode.AUTHENTICATED);
        form.setStatus(FormStatus.PUBLISHED);
        form.setSlug(slug);
        formRepository.save(form);
    }

    private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId()))
                .contentType(MediaType.APPLICATION_JSON);
    }

    private MockHttpServletRequestBuilder ban(User actor, String body) {
        return as(actor, post("/api/v1/guilds/{g}/bans", GUILD)).content(body);
    }

    @Test
    void staffBanByIdOrUsernameAndList() throws Exception {
        mvc.perform(ban(moderator, "{\"username\": \"SPAMMER\", \"reason\": \"  spam  \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.discordId").value("3"))
                .andExpect(jsonPath("$.username").value("spammer"))
                .andExpect(jsonPath("$.reason").value("spam"))
                .andExpect(jsonPath("$.bannedByUsername").value("mod"));

        // Someone who never logged in can be banned by raw ID.
        mvc.perform(ban(owner, "{\"discordId\": \"999\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").doesNotExist());

        mvc.perform(as(owner, get("/api/v1/guilds/{g}/bans", GUILD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        mvc.perform(ban(owner, "{\"discordId\": \"3\"}")).andExpect(status().isConflict());
    }

    @Test
    void staffAndSelfCannotBeBanned() throws Exception {
        mvc.perform(ban(moderator, "{\"discordId\": \"1\"}")).andExpect(status().isBadRequest());
        mvc.perform(ban(owner, "{\"discordId\": \"2\"}")).andExpect(status().isBadRequest());
        mvc.perform(ban(owner, "{\"discordId\": \"1\"}")).andExpect(status().isBadRequest());
        mvc.perform(ban(owner, "{}")).andExpect(status().isBadRequest());
        mvc.perform(ban(owner, "{\"discordId\": \"abc\"}")).andExpect(status().isBadRequest());
    }

    @Test
    void respondentsCannotManageBans() throws Exception {
        mvc.perform(as(respondent, get("/api/v1/guilds/{g}/bans", GUILD))).andExpect(status().isForbidden());
        mvc.perform(ban(respondent, "{\"discordId\": \"999\"}")).andExpect(status().isForbidden());
    }

    @Test
    void aBannedRespondentIsTurnedAwayUntilUnbanned() throws Exception {
        publishedForm("ban-form");
        String answers = "{\"answers\": {\"nick\": \"Bob\"}}";

        mvc.perform(ban(owner, "{\"discordId\": \"3\"}")).andExpect(status().isCreated());

        mvc.perform(as(respondent, get("/api/v1/public/forms/{s}", "ban-form")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewerAccess").value("GUILD_BANNED"));
        mvc.perform(as(respondent, post("/api/v1/public/forms/{s}/submissions", "ban-form")).content(answers))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("You are banned from submitting forms on this server"));

        mvc.perform(as(owner, delete("/api/v1/guilds/{g}/bans/{id}", GUILD, 3L))).andExpect(status().isNoContent());
        mvc.perform(as(owner, delete("/api/v1/guilds/{g}/bans/{id}", GUILD, 3L))).andExpect(status().isNotFound());

        mvc.perform(as(respondent, get("/api/v1/public/forms/{s}", "ban-form")))
                .andExpect(jsonPath("$.viewerAccess").value("GRANTED"));
        mvc.perform(as(respondent, post("/api/v1/public/forms/{s}/submissions", "ban-form")).content(answers))
                .andExpect(status().isCreated());
    }

    @Test
    void aBanForATermShowsItsEndAndStopsWorkingOnceItLapses() throws Exception {
        publishedForm("term-form");
        mvc.perform(ban(owner, "{\"discordId\": \"3\", \"expiresAt\": \"2020-01-01T00:00:00\"}"))
                .andExpect(status().isBadRequest());
        String until = java.time.LocalDateTime.now().plusDays(7).withNano(0).toString();
        mvc.perform(ban(owner, "{\"discordId\": \"3\", \"reason\": \"флуд\", \"expiresAt\": \"" + until + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.expiresAt").value(until));
        mvc.perform(as(respondent, get("/api/v1/public/forms/{s}", "term-form")))
                .andExpect(jsonPath("$.viewerAccess").value("GUILD_BANNED"))
                .andExpect(jsonPath("$.access.until").value(org.hamcrest.Matchers.startsWith(until.substring(0, 16))));

        // The term runs out: the ban no longer applies, isn't listed, and a new one can be issued.
        var entry = banListRepository.findByGuildIdAndDiscordId(GUILD, 3L).orElseThrow();
        entry.setExpiresAt(java.time.LocalDateTime.now().minusMinutes(1));
        banListRepository.save(entry);
        mvc.perform(as(respondent, get("/api/v1/public/forms/{s}", "term-form")))
                .andExpect(jsonPath("$.viewerAccess").value("GRANTED"));
        mvc.perform(as(owner, get("/api/v1/guilds/{g}/bans", GUILD))).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(ban(owner, "{\"discordId\": \"3\"}")).andExpect(status().isCreated())
                .andExpect(jsonPath("$.expiresAt").doesNotExist());
    }
}
