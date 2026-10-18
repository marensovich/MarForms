package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Guild audit log (E2.5): moderator actions are recorded with the right
 * actor and guild, and only the owner can read them.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class GuildAuditControllerTest {

    private static final long GUILD = 8201L;
    private static final long OTHER_GUILD = 8202L;

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
    private FormRepository formRepository;
    @Autowired
    private SubmissionRepository submissionRepository;

    private User owner;
    private User moderator;
    private Submission submission;

    @BeforeEach
    void setUp() {
        Guild guild = guild(GUILD);
        Guild other = guild(OTHER_GUILD);
        owner = user(1L, "owner");
        membership(owner, guild, GuildRole.OWNER);
        membership(owner, other, GuildRole.OWNER);
        moderator = user(2L, "mod");
        membership(moderator, guild, GuildRole.MODERATOR);
        user(3L, "newbie");
        User author = user(4L, "author");
        membership(author, guild, GuildRole.RESPONDENT);

        FormSchema schema = new FormSchema();
        schema.setTitle("Application");
        Form form = new Form();
        form.setServerId(GUILD);
        form.setSchema(schema);
        form.setStatus(FormStatus.PUBLISHED);
        form.setSlug("audit-form");
        form = formRepository.save(form);

        submission = new Submission();
        submission.setFormId(form.getId());
        submission.setDiscordId(author.getDiscordId());
        submission.setAnswers(Map.of("q", "a"));
        submission = submissionRepository.save(submission);
    }

    private Guild guild(long id) {
        Guild g = new Guild();
        g.setDiscordGuildId(id);
        g.setName("Guild " + id);
        return guildRepository.save(g);
    }

    private User user(long discordId, String name) {
        User u = new User();
        u.setDiscordId(discordId);
        u.setDiscordUsername(name);
        return userRepository.save(u);
    }

    private void membership(User user, Guild guild, GuildRole role) {
        GuildMembership m = new GuildMembership();
        m.setUser(user);
        m.setGuild(guild);
        m.setRole(role);
        guildMembershipRepository.save(m);
    }

    private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId()))
                .contentType(MediaType.APPLICATION_JSON);
    }

    @Test
    void moderatorActionsAreRecordedForTheOwner() throws Exception {
        mvc.perform(as(moderator, post("/api/v1/submissions/{id}/decision", submission.getId()))
                        .content("{\"status\": \"REJECTED\", \"comment\": \"Too short\"}"))
                .andExpect(status().isOk());
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/moderators", GUILD)).content("{\"discordId\": \"3\"}"))
                .andExpect(status().isCreated());
        mvc.perform(as(owner, delete("/api/v1/guilds/{g}/moderators/{id}", GUILD, 3L)))
                .andExpect(status().isNoContent());
        mvc.perform(as(moderator, post("/api/v1/guilds/{g}/bans", GUILD)).content("{\"discordId\": \"4\", \"reason\": \"spam\"}"))
                .andExpect(status().isCreated());
        mvc.perform(as(owner, delete("/api/v1/guilds/{g}/bans/{id}", GUILD, 4L)))
                .andExpect(status().isNoContent());
        // Another guild's actions stay there.
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/bans", OTHER_GUILD)).content("{\"discordId\": \"4\"}"))
                .andExpect(status().isCreated());

        mvc.perform(as(owner, get("/api/v1/guilds/{g}/audit-log", GUILD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(5))
                .andExpect(jsonPath("$.nextCursor").doesNotExist());

        mvc.perform(as(owner, get("/api/v1/guilds/{g}/audit-log", GUILD).param("action", "SUBMISSION_DECIDED")))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].actorDiscordId").value("2"))
                .andExpect(jsonPath("$.items[0].actorUsername").value("mod"))
                .andExpect(jsonPath("$.items[0].targetType").value("SUBMISSION"))
                .andExpect(jsonPath("$.items[0].targetName").value("Application"))
                .andExpect(jsonPath("$.items[0].metadata.from").value("PENDING"))
                .andExpect(jsonPath("$.items[0].metadata.to").value("REJECTED"))
                .andExpect(jsonPath("$.items[0].metadata.comment").value("Too short"));

        mvc.perform(as(owner, get("/api/v1/guilds/{g}/audit-log", GUILD).param("actorId", "2")))
                .andExpect(jsonPath("$.items.length()").value(2));

        mvc.perform(as(owner, get("/api/v1/guilds/{g}/audit-log", GUILD).param("action", "GUILD_BAN_ADDED")))
                .andExpect(jsonPath("$.items[0].targetName").value("author"))
                .andExpect(jsonPath("$.items[0].metadata.reason").value("spam"));

        mvc.perform(as(owner, get("/api/v1/guilds/{g}/audit-log", GUILD).param("action", "MODERATOR_ADDED")))
                .andExpect(jsonPath("$.items[0].targetId").value("3"))
                .andExpect(jsonPath("$.items[0].targetName").value("newbie"));
    }

    @Test
    void theFeedFiltersBySeveralActionsAndPagesByCursor() throws Exception {
        for (long id = 10; id < 15; id++) {
            mvc.perform(as(moderator, post("/api/v1/guilds/{g}/bans", GUILD)).content("{\"discordId\": \"" + id + "\"}"))
                    .andExpect(status().isCreated());
        }
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/moderators", GUILD)).content("{\"discordId\": \"3\"}"))
                .andExpect(status().isCreated());

        mvc.perform(as(owner, get("/api/v1/guilds/{g}/audit-log", GUILD)
                        .param("action", "GUILD_BAN_ADDED", "MODERATOR_ADDED").param("days", "7")))
                .andExpect(jsonPath("$.items.length()").value(6));

        String first = mvc.perform(as(owner, get("/api/v1/guilds/{g}/audit-log", GUILD).param("size", "4")))
                .andExpect(jsonPath("$.items.length()").value(4))
                .andExpect(jsonPath("$.items[0].action").value("MODERATOR_ADDED"))
                .andReturn().getResponse().getContentAsString();
        String cursor = com.jayway.jsonpath.JsonPath.read(first, "$.nextCursor");
        mvc.perform(as(owner, get("/api/v1/guilds/{g}/audit-log", GUILD).param("size", "4").param("cursor", cursor)))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.nextCursor").doesNotExist());

        mvc.perform(as(owner, get("/api/v1/guilds/{g}/audit-log/actors", GUILD)))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.discordId == '2')].username").value("mod"));
    }

    @Test
    void formChangesReachTheServersJournal() throws Exception {
        String body = mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms", GUILD))
                        .content("{\"schema\": {\"title\": \"Набор\", \"description\": \"\", \"fields\": [{\"id\": \"a\", \"type\": \"TEXT\", \"label\": \"A\"}]}}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String formId = com.jayway.jsonpath.JsonPath.read(body, "$.id");
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms/{f}/publish", GUILD, formId))).andExpect(status().isOk());

        mvc.perform(as(owner, get("/api/v1/guilds/{g}/audit-log", GUILD).param("action", "FORM_CREATED", "FORM_STATUS_CHANGED")))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].action").value("FORM_STATUS_CHANGED"))
                .andExpect(jsonPath("$.items[0].metadata.to").value("PUBLISHED"))
                .andExpect(jsonPath("$.items[0].targetName").value("Набор"));
    }

    @Test
    void moderatorsReadTheAuditLogButRespondentsDont() throws Exception {
        // ТЗ 4.3: only «Модераторы» and «Тариф» are the owner's; the log is the staff's (#126).
        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/audit-log", GUILD))).andExpect(status().isOk());
        User respondent = user(5L, "respondent");
        mvc.perform(as(respondent, get("/api/v1/guilds/{g}/audit-log", GUILD))).andExpect(status().isForbidden());
    }
}
