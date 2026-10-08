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
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Moderation module (E1.3), end-to-end through the security chain.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ModerationControllerTest {

    private static final long GUILD = 6101L;
    private static final long OTHER_GUILD = 6102L;

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

    private User moderator;
    private User alice;
    private User bob;
    private Form form;
    private Submission aliceSubmission;
    private Submission bobSubmission;
    private Submission otherGuildSubmission;

    @BeforeEach
    void setUp() {
        Guild guild = guild(GUILD);
        Guild other = guild(OTHER_GUILD);
        moderator = user(1L, "mod");
        membership(moderator, guild, GuildRole.MODERATOR);
        alice = user(2L, "alice");
        membership(alice, guild, GuildRole.RESPONDENT);
        bob = user(3L, "bob");

        form = form(GUILD, "Application");
        Form otherForm = form(OTHER_GUILD, "Other");
        aliceSubmission = submission(form, alice.getDiscordId(), SubmissionStatus.PENDING);
        bobSubmission = submission(form, bob.getDiscordId(), SubmissionStatus.APPROVED);
        otherGuildSubmission = submission(otherForm, bob.getDiscordId(), SubmissionStatus.PENDING);
        guildMembershipRepository.flush();
        other.getName();
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

    private Form form(long guildId, String title) {
        FormSchema schema = new FormSchema();
        schema.setTitle(title);
        Form f = new Form();
        f.setServerId(guildId);
        f.setSchema(schema);
        f.setStatus(FormStatus.PUBLISHED);
        f.setSlug("slug-" + UUID.randomUUID());
        return formRepository.save(f);
    }

    private Submission submission(Form form, Long discordId, SubmissionStatus status) {
        Submission s = new Submission();
        s.setFormId(form.getId());
        s.setDiscordId(discordId);
        s.setAnswers(Map.of("q", "a"));
        s.setStatus(status);
        return submissionRepository.save(s);
    }

    private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId()))
                .contentType(MediaType.APPLICATION_JSON);
    }

    @Test
    void aModeratorListsTheGuildsSubmissionsWithFilters() throws Exception {
        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/submissions", GUILD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].formTitle").value("Application"));

        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/submissions", GUILD).param("status", "PENDING")))
                .andExpect(jsonPath("$.page.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].discordUsername").value("alice"));

        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/submissions", GUILD).param("query", "BO")))
                .andExpect(jsonPath("$.page.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(bobSubmission.getId().toString()));

        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/submissions", GUILD).param("query", "2")))
                .andExpect(jsonPath("$.content[0].id").value(aliceSubmission.getId().toString()));

        mvc.perform(as(moderator, get("/api/v1/forms/{f}/submissions", form.getId()).param("status", "APPROVED")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.totalElements").value(1));
    }

    @Test
    void respondentsCannotModerate() throws Exception {
        mvc.perform(as(alice, get("/api/v1/guilds/{g}/submissions", GUILD))).andExpect(status().isForbidden());
        mvc.perform(as(alice, get("/api/v1/submissions/{id}", aliceSubmission.getId()))).andExpect(status().isForbidden());
        mvc.perform(as(alice, post("/api/v1/submissions/{id}/decision", aliceSubmission.getId()))
                        .content("{\"status\": \"APPROVED\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void aModeratorCannotTouchAnotherGuildsSubmissions() throws Exception {
        mvc.perform(as(moderator, post("/api/v1/submissions/{id}/decision", otherGuildSubmission.getId()))
                        .content("{\"status\": \"APPROVED\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/submissions", OTHER_GUILD))).andExpect(status().isForbidden());
    }

    @Test
    void decisionsRecordTheModeratorAndCanBeRevised() throws Exception {
        mvc.perform(as(moderator, post("/api/v1/submissions/{id}/decision", aliceSubmission.getId()))
                        .content("{\"status\": \"NEEDS_REVISION\", \"comment\": \"Add your age\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NEEDS_REVISION"))
                .andExpect(jsonPath("$.moderatorDiscordId").value("1"))
                .andExpect(jsonPath("$.moderatorComment").value("Add your age"))
                .andExpect(jsonPath("$.decidedAt").exists());

        mvc.perform(as(moderator, post("/api/v1/submissions/{id}/decision", aliceSubmission.getId()))
                        .content("{\"status\": \"APPROVED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.moderatorComment").doesNotExist());

        mvc.perform(as(moderator, post("/api/v1/submissions/{id}/decision", aliceSubmission.getId()))
                        .content("{\"status\": \"PENDING\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void theCardShowsAnswersSchemaAndAuthor() throws Exception {
        mvc.perform(as(moderator, get("/api/v1/submissions/{id}", aliceSubmission.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.submission.answers.q").value("a"))
                .andExpect(jsonPath("$.schema.title").value("Application"))
                .andExpect(jsonPath("$.author.username").value("alice"))
                .andExpect(jsonPath("$.author.submissionCount").value(1));
    }

    @Test
    void aRespondentSeesTheirOwnSubmissionsAndOutcome() throws Exception {
        mvc.perform(as(bob, get("/api/v1/me/submissions")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].moderatorDiscordId").doesNotExist());
    }
}
