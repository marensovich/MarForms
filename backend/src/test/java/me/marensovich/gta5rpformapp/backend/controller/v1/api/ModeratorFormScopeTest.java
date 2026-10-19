package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.audit.AuditAction;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.data.notifications.NotificationType;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.AuditLogRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.NotificationRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A moderator the owner narrowed to some forms of the server (#18, #90–#92):
 * the forms list, the form itself, the queue, a submission, search, «Мои
 * серверы» and notifications all follow the narrowing.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ModeratorFormScopeTest {

    private static final long GUILD = 9101L;
    private static final long OTHER_GUILD = 9102L;

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
    private SubmissionRepository submissionRepository;
    @Autowired
    private AuditLogRepository auditLogRepository;
    @Autowired
    private NotificationRepository notificationRepository;
    @Autowired
    private NotificationService notificationService;
    @Autowired
    private jakarta.persistence.EntityManager entityManager;

    private User owner;
    private User moderator;
    private String lspd;
    private String ems;
    private UUID lspdSubmission;
    private UUID emsSubmission;

    @BeforeEach
    void setUp() throws Exception {
        Guild guild = guild(GUILD);
        owner = user(1L, guild, GuildRole.OWNER);
        moderator = user(2L, guild, GuildRole.MODERATOR);
        membership(owner, guild(OTHER_GUILD), GuildRole.OWNER);
        lspd = createForm(GUILD, "LSPD Academy");
        ems = createForm(GUILD, "EMS Academy");
        lspdSubmission = submission(lspd, 77L);
        emsSubmission = submission(ems, 77L);
    }

    @Test
    void aModeratorStartsWithEveryForm() throws Exception {
        mvc.perform(as(owner, get("/api/v1/guilds/{g}/moderators", GUILD)))
                .andExpect(jsonPath("$[1].discordId").value("2"))
                .andExpect(jsonPath("$[1].formsRestricted").value(false))
                .andExpect(jsonPath("$[1].formIds", hasSize(0)));
        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/forms", GUILD))).andExpect(jsonPath("$.content", hasSize(2)));
        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/submissions", GUILD))).andExpect(jsonPath("$.content", hasSize(2)));
    }

    @Test
    void aNarrowedModeratorReachesOnlyTheirForms() throws Exception {
        narrow(lspd)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.formsRestricted").value(true))
                .andExpect(jsonPath("$.formIds[0]").value(lspd));

        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/forms", GUILD)))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(lspd));
        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/forms/{f}", GUILD, lspd))).andExpect(status().isOk());
        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/forms/{f}", GUILD, ems))).andExpect(status().isForbidden());

        // The queue: only their form's submissions; asking for the other form is a 404, like a form of another server.
        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/submissions", GUILD)))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(lspdSubmission.toString()));
        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/submissions", GUILD).param("formId", ems)))
                .andExpect(status().isNotFound());
        mvc.perform(as(moderator, get("/api/v1/submissions/{id}", emsSubmission))).andExpect(status().isForbidden());
        mvc.perform(as(moderator, post("/api/v1/submissions/{id}/decision", emsSubmission))
                        .content("{\"status\": \"APPROVED\"}"))
                .andExpect(status().isForbidden());

        // ⌘K finds only their form.
        mvc.perform(as(moderator, get("/api/v1/search").param("q", "academy")))
                .andExpect(jsonPath("$.forms", hasSize(1)))
                .andExpect(jsonPath("$.forms[0].id").value(lspd));

        // «Мои серверы» counts only their form.
        mvc.perform(as(moderator, get("/api/v1/me/guilds")))
                .andExpect(jsonPath("$[0].pendingSubmissions").value(1));

        // The owner still sees everything.
        mvc.perform(as(owner, get("/api/v1/guilds/{g}/submissions", GUILD))).andExpect(jsonPath("$.content", hasSize(2)));

        assertThat(auditLogRepository.findAll()).anyMatch(e -> e.getAction() == AuditAction.MODERATOR_FORMS_CHANGED
                && "2".equals(e.getTargetId()) && Long.valueOf(GUILD).equals(e.getGuildId()));
    }

    @Test
    void notificationsAboutAFormReachOnlyItsModerators() throws Exception {
        narrow(lspd).andExpect(status().isOk());

        notificationService.notifyStaff(GUILD, UUID.fromString(ems), NotificationType.NEW_SUBMISSION, null, Map.of(), "/", null);
        assertThat(notificationRepository.findAllByRecipientDiscordId(2L, Pageable.unpaged()).getContent()).isEmpty();
        assertThat(notificationRepository.findAllByRecipientDiscordId(1L, Pageable.unpaged()).getContent()).hasSize(1);

        notificationService.notifyStaff(GUILD, UUID.fromString(lspd), NotificationType.NEW_SUBMISSION, null, Map.of(), "/", null);
        assertThat(notificationRepository.findAllByRecipientDiscordId(2L, Pageable.unpaged()).getContent()).hasSize(1);
    }

    @Test
    void deletingTheLastFormOfTheListLeavesNoneRatherThanAll() throws Exception {
        narrow(lspd).andExpect(status().isOk());
        mvc.perform(as(owner, delete("/api/v1/guilds/{g}/forms/{f}", GUILD, lspd))).andExpect(status().isNoContent());
        entityManager.flush();
        entityManager.clear();

        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/forms", GUILD))).andExpect(jsonPath("$.content", hasSize(0)));
        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/submissions", GUILD))).andExpect(jsonPath("$.content", hasSize(0)));
        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/forms/{f}", GUILD, ems))).andExpect(status().isForbidden());
    }

    @Test
    void allFormsAgainAndOnlyTheOwnerDecides() throws Exception {
        narrow(lspd).andExpect(status().isOk());
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/moderators/{u}/forms", GUILD, 2L))
                        .content("{\"restricted\": false, \"formIds\": []}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.formsRestricted").value(false));
        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/forms", GUILD))).andExpect(jsonPath("$.content", hasSize(2)));

        // A moderator can't widen their own access.
        mvc.perform(as(moderator, put("/api/v1/guilds/{g}/moderators/{u}/forms", GUILD, 2L))
                        .content("{\"restricted\": false, \"formIds\": []}"))
                .andExpect(status().isForbidden());
        // Only forms of this server; the owner isn't a moderator to narrow.
        String foreign = createForm(OTHER_GUILD, "Other");
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/moderators/{u}/forms", GUILD, 2L))
                        .content("{\"restricted\": true, \"formIds\": [\"" + foreign + "\"]}"))
                .andExpect(status().isNotFound());
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/moderators/{u}/forms", GUILD, 1L))
                        .content("{\"restricted\": true, \"formIds\": []}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void aModeratorRemovedAndAddedAgainStartsWithEveryForm() throws Exception {
        narrow(lspd).andExpect(status().isOk());
        mvc.perform(as(owner, delete("/api/v1/guilds/{g}/moderators/{u}", GUILD, 2L))).andExpect(status().isNoContent());
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/moderators", GUILD)).content("{\"discordId\": \"2\"}"))
                .andExpect(jsonPath("$.formsRestricted").value(false));
        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/forms", GUILD))).andExpect(jsonPath("$.content", hasSize(2)));
    }

    private org.springframework.test.web.servlet.ResultActions narrow(String... formIds) throws Exception {
        String ids = String.join("\", \"", formIds);
        return mvc.perform(as(owner, put("/api/v1/guilds/{g}/moderators/{u}/forms", GUILD, 2L))
                .content("{\"restricted\": true, \"formIds\": [\"" + ids + "\"]}"));
    }

    private String createForm(long guildId, String title) throws Exception {
        String body = mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms", guildId))
                        .content("{\"schema\": {\"title\": \"" + title + "\", \"description\": \"\", \"fields\": []}}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asText();
    }

    private UUID submission(String formId, long author) {
        Submission s = new Submission();
        s.setFormId(UUID.fromString(formId));
        s.setDiscordId(author);
        s.setAnswers(Map.of());
        return submissionRepository.save(s).getId();
    }

    private Guild guild(long id) {
        Guild g = new Guild();
        g.setDiscordGuildId(id);
        g.setName("Guild " + id);
        return guildRepository.save(g);
    }

    private User user(long discordId, Guild guild, GuildRole role) {
        User u = new User();
        u.setDiscordId(discordId);
        u.setDiscordUsername("user" + discordId);
        u = userRepository.save(u);
        membership(u, guild, role);
        return u;
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
}
