package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.forms.WebhookConfig;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Public form page + submission intake (E1.2), end-to-end through the
 * security chain — anonymous and logged-in respondents.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PublicFormControllerTest {

    private static final long GUILD = 7001L;
    private static final String ANSWERS = "{\"answers\": {\"nick\": \"Bob\"}}";

    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private SubmissionRepository submissionRepository;

    private Form form(String slug, FormAccessMode mode, FormStatus status) {
        FormField nick = new FormField();
        nick.setId("nick");
        nick.setType(FormField.FieldType.TEXT);
        nick.setLabel("Nickname");
        nick.setRequired(true);
        FormSchema schema = new FormSchema();
        schema.setTitle("Application");
        schema.setFields(new ArrayList<>(List.of(nick)));
        WebhookConfig webhook = new WebhookConfig();
        webhook.setUrl("https://example.invalid/api/webhooks/1/SECRET-TOKEN");

        Form form = new Form();
        form.setServerId(GUILD);
        form.setSchema(schema);
        form.setWebhooks(new ArrayList<>(List.of(webhook)));
        form.setAccessMode(mode);
        form.setStatus(status);
        form.setSlug(slug);
        return formRepository.save(form);
    }

    private User user(long discordId, boolean member) {
        User u = new User();
        u.setDiscordId(discordId);
        u.setDiscordUsername("user" + discordId);
        if (member) u.setGuildIds(Set.of(GUILD));
        return userRepository.save(u);
    }

    private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId()));
    }

    private MockHttpServletRequestBuilder submit(String slug) {
        return post("/api/v1/public/forms/{s}/submissions", slug).contentType(MediaType.APPLICATION_JSON).content(ANSWERS);
    }

    @Test
    void thePublicViewNeverExposesWebhooksAndReportsViewerAccess() throws Exception {
        form("auth-form", FormAccessMode.AUTHENTICATED, FormStatus.PUBLISHED);
        form("open-form", FormAccessMode.ANONYMOUS, FormStatus.PUBLISHED);

        String body = mvc.perform(get("/api/v1/public/forms/{s}", "auth-form"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewerAccess").value("AUTH_REQUIRED"))
                .andExpect(jsonPath("$.acceptingSubmissions").value(true))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("SECRET-TOKEN").doesNotContain("webhooks");

        mvc.perform(get("/api/v1/public/forms/{s}", "open-form"))
                .andExpect(jsonPath("$.viewerAccess").value("GRANTED"));
    }

    @Test
    void theLegacyByIdEndpointNoLongerLeaksWebhooksToRespondents() throws Exception {
        Form f = form("legacy", FormAccessMode.AUTHENTICATED, FormStatus.PUBLISHED);
        User respondent = user(10L, true);

        String body = mvc.perform(as(respondent, get("/api/v1/forms/{id}", f.getId())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("SECRET-TOKEN");
    }

    @Test
    void draftsAreInvisible() throws Exception {
        form("draft", FormAccessMode.OPEN, FormStatus.DRAFT);

        mvc.perform(get("/api/v1/public/forms/{s}", "draft")).andExpect(status().isNotFound());
        mvc.perform(submit("draft")).andExpect(status().isNotFound());
    }

    @Test
    void anOpenFormNeedsALoginButNotGuildMembership() throws Exception {
        // ТЗ 5.4, owner's decision of 2026-10-15: «Все» is anyone signed in; only «Анонимно» works without.
        Form f = form("open", FormAccessMode.OPEN, FormStatus.PUBLISHED);

        mvc.perform(get("/api/v1/public/forms/{s}", "open")).andExpect(jsonPath("$.viewerAccess").value("AUTH_REQUIRED"));
        mvc.perform(submit("open")).andExpect(status().isUnauthorized());
        mvc.perform(as(user(14L, false), submit("open")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("RECEIVED"));
        assertThat(submissionRepository.countByFormIdAndDiscordId(f.getId(), 14L)).isEqualTo(1);
    }

    @Test
    void anOpenFormStillRecordsALoggedInRespondent() throws Exception {
        Form f = form("open2", FormAccessMode.OPEN, FormStatus.PUBLISHED);
        User u = user(11L, false);

        mvc.perform(as(u, submit("open2"))).andExpect(status().isCreated());
        assertThat(submissionRepository.countByFormIdAndDiscordId(f.getId(), 11L)).isEqualTo(1);
    }

    @Test
    void anAuthenticatedFormNeedsLoginAndGuildMembership() throws Exception {
        form("members", FormAccessMode.AUTHENTICATED, FormStatus.PUBLISHED);

        mvc.perform(submit("members")).andExpect(status().isUnauthorized());
        mvc.perform(as(user(12L, false), submit("members"))).andExpect(status().isForbidden());
        mvc.perform(as(user(13L, true), submit("members"))).andExpect(status().isCreated());
    }

    @Test
    void invalidAnswersAreRejectedWithAnErrorPerField() throws Exception {
        form("strict", FormAccessMode.ANONYMOUS, FormStatus.PUBLISHED);

        mvc.perform(post("/api/v1/public/forms/{s}/submissions", "strict")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"answers\": {}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.nick").value("This field is required"));
    }

    @Test
    void theSameIdempotencyKeyNeverCreatesASecondSubmission() throws Exception {
        Form f = form("idem", FormAccessMode.ANONYMOUS, FormStatus.PUBLISHED);
        String key = UUID.randomUUID().toString();

        String first = mvc.perform(submit("idem").header("Idempotency-Key", key))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String second = mvc.perform(submit("idem").header("Idempotency-Key", key))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        assertThat(objectMapper.readTree(second).get("id")).isEqualTo(objectMapper.readTree(first).get("id"));
        assertThat(submissionRepository.countByFormId(f.getId())).isEqualTo(1);
    }

    @Test
    void aClosedFormGivesAReadableConflictNotA500() throws Exception {
        form("closed", FormAccessMode.ANONYMOUS, FormStatus.CLOSED);

        mvc.perform(get("/api/v1/public/forms/{s}", "closed"))
                .andExpect(jsonPath("$.acceptingSubmissions").value(false))
                .andExpect(jsonPath("$.notAcceptingReason").value(containsString("closed")));
        mvc.perform(submit("closed"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value(containsString("closed")));
    }

    @Test
    void thePerUserLimitIsEnforced() throws Exception {
        Form f = form("once", FormAccessMode.AUTHENTICATED, FormStatus.PUBLISHED);
        f.setSubmissionLimitPerUser(1);
        formRepository.save(f);
        User u = user(14L, true);

        mvc.perform(as(u, submit("once"))).andExpect(status().isCreated());
        mvc.perform(as(u, submit("once")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("You have already submitted this form"));
    }

    @Test
    void anAnonymousFormNeverRecordsWhoSubmitted() throws Exception {
        form("anon", FormAccessMode.ANONYMOUS, FormStatus.PUBLISHED);
        User outsider = user(15L, false);

        mvc.perform(get("/api/v1/public/forms/{s}", "anon"))
                .andExpect(jsonPath("$.viewerAccess").value("GRANTED"));
        mvc.perform(submit("anon")).andExpect(status().isCreated());

        // Logged in and not even a member: still accepted, still not recorded.
        String body = mvc.perform(as(outsider, submit("anon")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        UUID id = UUID.fromString(objectMapper.readTree(body).get("id").asText());
        assertThat(submissionRepository.findById(id).orElseThrow().getDiscordId()).isNull();
    }

    @Test
    void anAnonymousFormLimitsPerBrowserToken() throws Exception {
        Form f = form("anon-once", FormAccessMode.ANONYMOUS, FormStatus.PUBLISHED);
        f.setSubmissionLimitPerUser(1);
        formRepository.save(f);
        String browserA = "a".repeat(32);

        mvc.perform(submit("anon-once")).andExpect(status().isBadRequest());
        mvc.perform(submit("anon-once").header("Anonymous-Token", "short")).andExpect(status().isBadRequest());

        mvc.perform(submit("anon-once").header("Anonymous-Token", browserA).header("Idempotency-Key", "k-anon-1"))
                .andExpect(status().isCreated());
        // A retry of the same request is the same submission, not a limit hit.
        mvc.perform(submit("anon-once").header("Anonymous-Token", browserA).header("Idempotency-Key", "k-anon-1"))
                .andExpect(status().isOk());
        mvc.perform(submit("anon-once").header("Anonymous-Token", browserA))
                .andExpect(status().isConflict());
        mvc.perform(submit("anon-once").header("Anonymous-Token", "b".repeat(32)))
                .andExpect(status().isCreated());

        // Only a per-form hash is stored, never the token itself.
        assertThat(submissionRepository.findAll().stream().filter(s -> s.getFormId().equals(f.getId())).toList()).extracting(s -> s.getAnonymousToken())
                .doesNotContainNull().doesNotContain(browserA).allMatch(t -> t.length() == 64);
    }
}
