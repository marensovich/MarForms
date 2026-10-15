package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * «Нужна доработка» → sent again → «На рассмотрении», with the history (#119, ТЗ 9.1).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ResubmitTest {

    private static final long GUILD = 6301L;

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

    private User author;
    private User moderator;
    private Submission submission;

    @BeforeEach
    void setUp() {
        Guild guild = new Guild();
        guild.setDiscordGuildId(GUILD);
        guild.setName("Resubmit guild");
        guild = guildRepository.save(guild);
        author = user(63L, "author", guild, GuildRole.RESPONDENT);
        moderator = user(64L, "mod", guild, GuildRole.MODERATOR);

        FormField age = new FormField();
        age.setId("age");
        age.setType(FormField.FieldType.NUMBER);
        age.setLabel("Возраст");
        age.setRequired(true);
        FormSchema schema = new FormSchema();
        schema.setTitle("Набор");
        schema.setFields(new ArrayList<>(List.of(age)));
        Form form = new Form();
        form.setServerId(GUILD);
        form.setSchema(schema);
        form.setStatus(FormStatus.PUBLISHED);
        form.setAccessMode(FormAccessMode.OPEN);
        form.setSubmissionLimitPerUser(1);
        form.setSlug("resubmit-form");
        form = formRepository.save(form);

        submission = new Submission();
        submission.setFormId(form.getId());
        submission.setDiscordId(author.getDiscordId());
        submission.setAnswers(new HashMap<>(Map.of("age", "17")));
        submission.setStatus(SubmissionStatus.PENDING);
        submission = submissionRepository.saveAndFlush(submission);
    }

    @Test
    void theAuthorSendsItAgainAfterRevisionWithoutUsingTheLimit() throws Exception {
        // Not sent back yet: nothing to resubmit.
        mvc.perform(resubmit(author, "{\"answers\": {\"age\": \"21\"}}")).andExpect(status().isConflict());

        mvc.perform(as(moderator, post("/api/v1/submissions/{id}/decision", submission.getId()))
                        .content("{\"status\": \"NEEDS_REVISION\", \"comment\": \"Укажите реальный возраст\"}"))
                .andExpect(status().isOk());

        // Someone else's submission, and invalid answers, are refused.
        mvc.perform(resubmit(moderator, "{\"answers\": {\"age\": \"21\"}}")).andExpect(status().isNotFound());
        mvc.perform(resubmit(author, "{\"answers\": {}}")).andExpect(status().isBadRequest());

        // The form allows one submission per person: resubmitting isn't a new one.
        mvc.perform(resubmit(author, "{\"answers\": {\"age\": \"21\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));

        mvc.perform(as(author, get("/api/v1/me/submissions/{id}", submission.getId())))
                .andExpect(jsonPath("$.answers.age").value(21))
                .andExpect(jsonPath("$.submission.status").value("PENDING"))
                .andExpect(jsonPath("$.submission.moderatorComment").doesNotExist())
                .andExpect(jsonPath("$.history[*].type").value(org.hamcrest.Matchers.contains("DECIDED", "RESUBMITTED")))
                .andExpect(jsonPath("$.history[0].comment").value("Укажите реальный возраст"));
    }

    private MockHttpServletRequestBuilder resubmit(User user, String body) {
        return as(user, post("/api/v1/me/submissions/{id}/resubmit", submission.getId())).content(body);
    }

    private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId()))
                .contentType(MediaType.APPLICATION_JSON);
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
