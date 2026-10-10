package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.data.guilds.PlanTier;
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
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Plan limits (E4.1): owner actions over a limit are refused with a clear
 * 402; respondents are never blocked, whatever the plan.
 */
@SpringBootTest(properties = {
        "app.plans.limits.FREE.active-forms=1",
        "app.plans.limits.FREE.submissions-per-month=1",
        "app.plans.limits.FREE.moderators=1",
})
@AutoConfigureMockMvc
@Transactional
class PlanLimitsTest {

    private static final long GUILD = 8501L;
    private static final String NEW_FORM = "{\"schema\": {\"title\": \"Another\", \"description\": \"\", \"fields\": []}}";

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

    private Guild guild;
    private User owner;
    private Form form;

    private User user(long id, String name, GuildRole role) {
        User u = new User();
        u.setDiscordId(id);
        u.setDiscordUsername(name);
        u.setGuildIds(Set.of(GUILD));
        u = userRepository.save(u);
        if (role != null) {
            GuildMembership m = new GuildMembership();
            m.setUser(u);
            m.setGuild(guild);
            m.setRole(role);
            guildMembershipRepository.save(m);
        }
        return u;
    }

    @BeforeEach
    void setUp() {
        guild = new Guild();
        guild.setDiscordGuildId(GUILD);
        guild.setName("Guild");
        guild = guildRepository.save(guild);
        owner = user(1L, "owner", GuildRole.OWNER);
        user(2L, "mod", GuildRole.MODERATOR);
        user(3L, "candidate", GuildRole.RESPONDENT);

        FormField nick = new FormField();
        nick.setId("nick");
        nick.setType(FormField.FieldType.TEXT);
        nick.setLabel("Nick");
        FormSchema schema = new FormSchema();
        schema.setTitle("Application");
        schema.setFields(new ArrayList<>(List.of(nick)));
        form = new Form();
        form.setServerId(GUILD);
        form.setSchema(schema);
        form.setAccessMode(FormAccessMode.OPEN);
        form.setStatus(FormStatus.PUBLISHED);
        form.setSlug("limits-form");
        form = formRepository.save(form);

        Submission s = new Submission();
        s.setFormId(form.getId());
        s.setAnswers(Map.of("nick", "first"));
        submissionRepository.save(s);
    }

    private MockHttpServletRequestBuilder asOwner(MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwtUtil.generateToken(owner.getDiscordId()))
                .contentType(MediaType.APPLICATION_JSON);
    }

    @Test
    void ownerActionsOverTheLimitAreRefusedClearly() throws Exception {
        mvc.perform(asOwner(post("/api/v1/guilds/{g}/forms", GUILD)).content(NEW_FORM))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.metric").value("ACTIVE_FORMS"))
                .andExpect(jsonPath("$.limit").value(1))
                .andExpect(jsonPath("$.plan").value("FREE"));

        mvc.perform(asOwner(post("/api/v1/guilds/{g}/moderators", GUILD)).content("{\"discordId\": \"3\"}"))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.metric").value("MODERATORS"));

        // Archiving frees a slot; un-archiving needs one.
        mvc.perform(asOwner(put("/api/v1/guilds/{g}/forms/{f}/status", GUILD, form.getId())).content("{\"status\": \"ARCHIVED\"}"))
                .andExpect(status().isOk());
        mvc.perform(asOwner(post("/api/v1/guilds/{g}/forms", GUILD)).content(NEW_FORM))
                .andExpect(status().isCreated());
        mvc.perform(asOwner(put("/api/v1/guilds/{g}/forms/{f}/status", GUILD, form.getId())).content("{\"status\": \"CLOSED\"}"))
                .andExpect(status().isPaymentRequired());

        // A paid plan with nothing configured is unlimited.
        guild.setPlanTier(PlanTier.PRO);
        guildRepository.save(guild);
        mvc.perform(asOwner(post("/api/v1/guilds/{g}/moderators", GUILD)).content("{\"discordId\": \"3\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void respondentsAreNeverBlockedAndTheOwnerSeesUsage() throws Exception {
        // Already at the monthly submission limit: the form still accepts answers.
        mvc.perform(get("/api/v1/public/forms/{s}", "limits-form"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.acceptingSubmissions").value(true));
        mvc.perform(post("/api/v1/public/forms/{s}/submissions", "limits-form")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"answers\": {\"nick\": \"second\"}}"))
                .andExpect(status().isCreated());

        mvc.perform(asOwner(get("/api/v1/guilds/{g}/usage", GUILD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan").value("FREE"))
                .andExpect(jsonPath("$.usage[0].metric").value("ACTIVE_FORMS"))
                .andExpect(jsonPath("$.usage[0].used").value(1))
                .andExpect(jsonPath("$.usage[0].limit").value(1))
                .andExpect(jsonPath("$.usage[1].metric").value("SUBMISSIONS_PER_MONTH"))
                .andExpect(jsonPath("$.usage[1].used").value(2))
                .andExpect(jsonPath("$.usage[2].used").value(1));
    }
}
