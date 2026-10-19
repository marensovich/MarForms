package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Guild-scoped form CRUD, publish and per-field API (E1.1), end-to-end
 * through the JWT filter, {@code @PreAuthorize} and the guild guard.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class GuildFormControllerTest {

    private static final long GUILD = 9001L;
    private static final long OTHER_GUILD = 9002L;

    private static final String DRAFT = """
            {"schema": {"title": "Заявка в состав", "description": "", "fields": []}}
            """;

    @Autowired
    private MockMvc mvc;
    @Autowired
    private me.marensovich.gta5rpformapp.backend.database.repository.FormRepository formRepository;
    @Autowired
    private jakarta.persistence.EntityManager entityManager;
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

    private User owner;
    private User moderator;
    private User respondent;

    @BeforeEach
    void setUp() {
        Guild guild = guild(GUILD);
        Guild other = guild(OTHER_GUILD);
        owner = user(1L, guild, GuildRole.OWNER);
        moderator = user(2L, guild, GuildRole.MODERATOR);
        respondent = user(3L, guild, GuildRole.RESPONDENT);
        // owner of the other guild too — used to prove cross-guild form ids are rejected
        membership(owner, other, GuildRole.OWNER);
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

    private String createDraft(long guildId) throws Exception {
        String body = mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms", guildId)).content(DRAFT))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.slug").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("id").asText();
    }

    private void addTextField(String formId) throws Exception {
        mvc.perform(as(owner, post("/api/v1/forms/{f}/fields", formId))
                        .content("{\"type\": \"TEXT\", \"label\": \"Nickname\", \"required\": true}"))
                .andExpect(status().isCreated());
    }

    @Test
    void ownerCreatesADraftThenPublishesItWithAUniqueSlug() throws Exception {
        String formId = createDraft(GUILD);

        mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms/{f}/publish", GUILD, formId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.fields").exists());

        addTextField(formId);

        mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms/{f}/publish", GUILD, formId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.slug").value(matchesPattern("zayavka-v-sostav-[a-z0-9]{6}")));
    }

    @Test
    void theSlugSurvivesClosingAndRepublishing() throws Exception {
        String formId = createDraft(GUILD);
        addTextField(formId);
        String first = slugOf(mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms/{f}/publish", GUILD, formId)))
                .andReturn().getResponse().getContentAsString());

        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}/status", GUILD, formId)).content("{\"status\":\"CLOSED\"}"))
                .andExpect(jsonPath("$.status").value("CLOSED"));
        String second = slugOf(mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms/{f}/publish", GUILD, formId)))
                .andReturn().getResponse().getContentAsString());

        assertThat(second).isEqualTo(first);
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}/status", GUILD, formId)).content("{\"status\":\"DRAFT\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void statusesMoveStrictlyByTheSpecTableAndAnArchivedFormComesBackAsACopy() throws Exception {
        String formId = createDraft(GUILD);
        addTextField(formId);
        for (String target : new String[]{"CLOSED", "ARCHIVED"}) {
            mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}/status", GUILD, formId))
                            .content("{\"status\":\"" + target + "\"}"))
                    .andExpect(status().isConflict());
        }
        String slug = slugOf(mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms/{f}/publish", GUILD, formId)))
                .andReturn().getResponse().getContentAsString());
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}/status", GUILD, formId)).content("{\"status\":\"ARCHIVED\"}"))
                .andExpect(jsonPath("$.status").value("ARCHIVED"));

        // Archived is final: no reopening, no republishing.
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}/status", GUILD, formId)).content("{\"status\":\"CLOSED\"}"))
                .andExpect(status().isConflict());
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms/{f}/publish", GUILD, formId))).andExpect(status().isConflict());

        mvc.perform(as(moderator, post("/api/v1/guilds/{g}/forms/{f}/copy", GUILD, formId))).andExpect(status().isForbidden());
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms/{f}/copy", GUILD, formId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.slug").doesNotExist())
                .andExpect(jsonPath("$.schema.title").value("Заявка в состав"))
                .andExpect(jsonPath("$.schema.fields[0].label").value("Nickname"));

        mvc.perform(as(owner, get("/api/v1/guilds/{g}/forms?includeArchived=true", GUILD)))
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[?(@.status == 'ARCHIVED')].slug").value(slug))
                .andExpect(jsonPath("$.content[0].pendingCount").value(0));
    }

    @Test
    void anEmbedWithABadLinkOrTooLongATitleIsRefusedOnSave() throws Exception {
        String formId = createDraft(GUILD);
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}", GUILD, formId))
                        .content("{\"webhooks\": [{\"url\": \"https://discord.com/api/webhooks/77/t\", \"thumbnailUrl\": \"javascript:alert(1)\", \"embedTitle\": \""
                                + "a".repeat(257) + "\", \"color\": 16777216}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields['webhooks[0].thumbnailUrl']").exists())
                .andExpect(jsonPath("$.fields['webhooks[0].embedTitle']").exists())
                .andExpect(jsonPath("$.fields['webhooks[0].color']").exists());
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}", GUILD, formId))
                        .content("{\"webhooks\": [{\"url\": \"https://discord.com/api/webhooks/77/t\", \"footerText\": \"MarForms\", \"timestamp\": false}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.webhooks[0].footerText").value("MarForms"))
                .andExpect(jsonPath("$.webhooks[0].timestamp").value(false));
    }

    @Test
    void anOwnerChoosesTheFormsAddressAndItMustBeFreeAndWellFormed() throws Exception {
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms", GUILD))
                        .content("{\"schema\": {\"title\": \"LSPD\", \"description\": \"\", \"fields\": []}, \"slug\": \"Bad Slug\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.slug").exists());
        String body = mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms", GUILD))
                        .content("{\"schema\": {\"title\": \"LSPD\", \"description\": \"\", \"fields\": []}, \"slug\": \"lspd-2026\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.slug").value("lspd-2026"))
                .andReturn().getResponse().getContentAsString();
        String formId = objectMapper.readTree(body).get("id").asText();
        addTextField(formId);
        // Publishing keeps the chosen address.
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms/{f}/publish", GUILD, formId)))
                .andExpect(jsonPath("$.slug").value("lspd-2026"));

        mvc.perform(as(owner, get("/api/v1/forms/slug-available").param("slug", "lspd-2026")))
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.reason").value("TAKEN"));
        mvc.perform(as(owner, get("/api/v1/forms/slug-available").param("slug", "lspd-2026").param("formId", formId)))
                .andExpect(jsonPath("$.available").value(true));
        mvc.perform(as(owner, get("/api/v1/forms/slug-available").param("slug", "ab")))
                .andExpect(jsonPath("$.reason").value("FORMAT"));

        String other = createDraft(GUILD);
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}", GUILD, other)).content("{\"slug\": \"lspd-2026\"}"))
                .andExpect(status().isConflict());
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}", GUILD, formId)).content("{\"slug\": \"lspd-new\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("lspd-new"));
        mvc.perform(get("/api/v1/public/forms/{s}", "lspd-2026")).andExpect(status().isNotFound());
    }

    private String slugOf(String json) throws Exception {
        return objectMapper.readTree(json).get("slug").asText();
    }

    @Test
    void onlyTheOwnerMayCreateEditOrDelete() throws Exception {
        String formId = createDraft(GUILD);

        for (User u : new User[]{moderator, respondent}) {
            mvc.perform(as(u, post("/api/v1/guilds/{g}/forms", GUILD)).content(DRAFT)).andExpect(status().isForbidden());
            mvc.perform(as(u, post("/api/v1/guilds/{g}/forms/{f}/publish", GUILD, formId))).andExpect(status().isForbidden());
            mvc.perform(as(u, delete("/api/v1/guilds/{g}/forms/{f}", GUILD, formId))).andExpect(status().isForbidden());
            mvc.perform(as(u, post("/api/v1/forms/{f}/fields", formId)).content("{\"type\":\"TEXT\",\"label\":\"x\"}"))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void moderatorsCanReadButRespondentsCannot() throws Exception {
        String formId = createDraft(GUILD);

        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/forms", GUILD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(formId));
        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/forms/{f}", GUILD, formId))).andExpect(status().isOk());
        mvc.perform(as(respondent, get("/api/v1/guilds/{g}/forms", GUILD))).andExpect(status().isForbidden());
    }

    @Test
    void nobodySeesWebhookTokensAndAMaskedUrlSavedBackKeepsTheStoredOne() throws Exception {
        String formId = createDraft(GUILD);
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}", GUILD, formId))
                        .content("{\"webhooks\": [{\"url\": \"https://discord.com/api/webhooks/77/secret-token\", \"events\": [\"DECISION\"]}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.webhooks[0].url").value("https://discord.com/api/webhooks/77/***"))
                .andExpect(jsonPath("$.webhooks[0].events[0]").value("DECISION"));

        // ТЗ 8.5 (#140): the owner too sees only …/***.
        mvc.perform(as(owner, get("/api/v1/guilds/{g}/forms/{f}", GUILD, formId)))
                .andExpect(jsonPath("$.webhooks[0].url").value("https://discord.com/api/webhooks/77/***"));
        // The editor sends the masked URL back: the stored token stays.
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}", GUILD, formId))
                        .content("{\"webhooks\": [{\"url\": \"https://discord.com/api/webhooks/77/***\", \"botName\": \"MF\"}]}"))
                .andExpect(status().isOk());
        var stored = formRepository.findById(java.util.UUID.fromString(formId)).orElseThrow().getWebhooks().getFirst();
        assertThat(stored.getUrl()).isEqualTo("https://discord.com/api/webhooks/77/secret-token");
        assertThat(stored.getBotName()).isEqualTo("MF");
        // A moderator sees that a webhook exists, not its token (#103).
        mvc.perform(as(moderator, get("/api/v1/guilds/{g}/forms/{f}", GUILD, formId)))
                .andExpect(jsonPath("$.webhooks[0].url").value("https://discord.com/api/webhooks/77/***"));
        mvc.perform(as(moderator, get("/api/v1/forms/{f}", formId)))
                .andExpect(jsonPath("$.webhooks[0].url").value("https://discord.com/api/webhooks/77/***"));
    }

    @Test
    void aFormFromAnotherGuildIsNotFoundEvenForAnOwnerOfBoth() throws Exception {
        String otherForm = createDraft(OTHER_GUILD);

        mvc.perform(as(owner, get("/api/v1/guilds/{g}/forms/{f}", GUILD, otherForm))).andExpect(status().isNotFound());
        mvc.perform(as(owner, delete("/api/v1/guilds/{g}/forms/{f}", GUILD, otherForm))).andExpect(status().isNotFound());
    }

    @Test
    void aSaveBasedOnAnOutdatedVersionIsRefusedAndSettingsSaveInTheSameRequest() throws Exception {
        String formId = createDraft(GUILD);
        long version = objectMapper.readTree(mvc.perform(as(owner, get("/api/v1/forms/{f}", formId)))
                .andReturn().getResponse().getContentAsString()).get("version").asLong();

        // One request, one transaction: fields and access settings together (#103).
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}", GUILD, formId)).content(
                        "{\"version\": " + version + ", \"settings\": {\"accessMode\": \"OPEN\", \"submissionLimitPerUser\": 2}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessMode").value("OPEN"))
                .andExpect(jsonPath("$.submissionLimitPerUser").value(2));
        entityManager.flush(); // the version moves on when the change is written

        // A second editor still holding the old version gets a 409 naming who saved, instead of overwriting.
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}", GUILD, formId)).content("{\"version\": " + version + ", \"active\": false}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.updatedBy").value("user1"))
                .andExpect(jsonPath("$.updatedAt").exists());
    }

    @Test
    void webhooksMustBeDiscordWebhooksAndAreStoredCanonically() throws Exception {
        String formId = createDraft(GUILD);

        // SSRF (#103): a webhook can never point the server at another host.
        for (String url : new String[]{"http://127.0.0.1:8090/", "http://169.254.169.254/latest/meta-data",
                "https://discord.com.evil.example/api/webhooks/1/x", "https://discord.com/api/webhooks/1/x?redirect=http://a"}) {
            mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}", GUILD, formId)).content("{\"webhooks\": [{\"url\": \"" + url + "\"}]}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fields['webhooks[0].url']").exists());
        }

        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}", GUILD, formId))
                        .content("{\"webhooks\": [{\"url\": \"https://discordapp.com/api/v10/webhooks/123/abc-DEF_9\", \"health\": \"HEALTHY\", \"lastError\": \"spoofed\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.webhooks[0].url").value("https://discord.com/api/webhooks/123/***"))
                .andExpect(jsonPath("$.webhooks[0].lastError").doesNotExist());
        assertThat(formRepository.findById(java.util.UUID.fromString(formId)).orElseThrow().getWebhooks().getFirst().getUrl())
                .isEqualTo("https://discord.com/api/webhooks/123/abc-DEF_9");
    }

    @Test
    void invalidFieldConfigurationIsRejectedWithPerFieldErrors() throws Exception {
        String formId = createDraft(GUILD);

        mvc.perform(as(owner, post("/api/v1/forms/{f}/fields", formId))
                        .content("{\"type\": \"RADIO\", \"label\": \"Pick\", \"options\": [\"only one\"]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields['fields[0].options']").value("Needs at least 2 options"));
    }

    @Test
    void reorderIsAllOrNothing() throws Exception {
        String formId = createDraft(GUILD);
        for (String label : new String[]{"A", "B", "C"}) {
            mvc.perform(as(owner, post("/api/v1/forms/{f}/fields", formId))
                    .content("{\"id\": \"" + label + "\", \"type\": \"TEXT\", \"label\": \"" + label + "\"}"));
        }

        mvc.perform(as(owner, put("/api/v1/forms/{f}/fields/reorder", formId)).content("{\"fieldIds\": [\"C\", \"A\"]}"))
                .andExpect(status().isBadRequest());

        String body = mvc.perform(as(owner, put("/api/v1/forms/{f}/fields/reorder", formId))
                        .content("{\"fieldIds\": [\"C\", \"A\", \"B\"]}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode fields = objectMapper.readTree(body).at("/schema/fields");
        assertThat(fields.get(0).get("id").asText()).isEqualTo("C");
        assertThat(fields.get(1).get("id").asText()).isEqualTo("A");
        assertThat(fields.get(2).get("id").asText()).isEqualTo("B");
    }

    @Test
    void accessModesIncludingAnonymous() throws Exception {
        String formId = createDraft(GUILD);

        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}/settings", GUILD, formId))
                        .content("{\"accessMode\": \"ANONYMOUS\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessMode").value("ANONYMOUS"));
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}/settings", GUILD, formId))
                        .content("{\"accessMode\": \"OPEN\", \"submissionLimitPerUser\": 1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessMode").value("OPEN"))
                .andExpect(jsonPath("$.submissionLimitPerUser").value(1));
        // There is no person to count on an anonymous form (ТЗ ФТ-5.4.4).
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}/settings", GUILD, formId))
                        .content("{\"accessMode\": \"ANONYMOUS\", \"submissionLimitPerUser\": 1}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void roleGatedNeedsARuleAndARoleCantBeBothAllowedAndDenied() throws Exception {
        String formId = createDraft(GUILD);

        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}/settings", GUILD, formId))
                        .content("{\"accessMode\": \"ROLE_GATED\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}/settings", GUILD, formId))
                        .content("{\"accessMode\": \"ROLE_GATED\", \"allowedRoleIds\": [\"11\"], \"deniedRoleIds\": [\"11\"]}"))
                .andExpect(status().isBadRequest());
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}/settings", GUILD, formId))
                        .content("{\"accessMode\": \"ROLE_GATED\", \"allowedRoleIds\": [\"1234567890123456789\"], \"deniedRoleIds\": [\"22\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessMode").value("ROLE_GATED"))
                .andExpect(jsonPath("$.allowedRoleIds[0]").value("1234567890123456789"))
                .andExpect(jsonPath("$.deniedRoleIds[0]").value("22"));
    }

    @Test
    void aPublishedFormMustKeepAtLeastOneInputField() throws Exception {
        String formId = createDraft(GUILD);
        mvc.perform(as(owner, post("/api/v1/forms/{f}/fields", formId))
                .content("{\"id\": \"only\", \"type\": \"TEXT\", \"label\": \"Only\"}"));
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms/{f}/publish", GUILD, formId))).andExpect(status().isOk());

        // The removal waits in the draft; publishing it is refused with the reason.
        mvc.perform(as(owner, delete("/api/v1/forms/{f}/fields/{id}", formId, "only"))).andExpect(status().isOk());
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms/{f}/publish-changes", GUILD, formId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.fields").value("Add at least one field to fill in"));
    }

    @Test
    void editsOfAPublishedFormWaitInADraftUntilTheyArePublished() throws Exception {
        String formId = createDraft(GUILD);
        addTextField(formId);
        String slug = slugOf(mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms/{f}/publish", GUILD, formId)))
                .andReturn().getResponse().getContentAsString());

        mvc.perform(as(owner, post("/api/v1/forms/{f}/fields", formId))
                        .content("{\"id\": \"age\", \"type\": \"NUMBER\", \"label\": \"Age\"}"))
                .andExpect(status().isCreated());

        // Respondents still see the published form.
        mvc.perform(get("/api/v1/public/forms/{s}", slug))
                .andExpect(jsonPath("$.schema.fields.length()").value(1));
        mvc.perform(as(owner, get("/api/v1/guilds/{g}/forms/{f}", GUILD, formId)))
                .andExpect(jsonPath("$.hasUnpublishedChanges").value(true))
                .andExpect(jsonPath("$.schema.fields.length()").value(1))
                .andExpect(jsonPath("$.draftSchema.fields.length()").value(2))
                .andExpect(jsonPath("$.updatedBy").value("1"));
        mvc.perform(as(owner, get("/api/v1/guilds/{g}/forms", GUILD)))
                .andExpect(jsonPath("$.content[0].hasUnpublishedChanges").value(true));
        mvc.perform(as(owner, get("/api/v1/guilds/{g}/forms/{f}/publish-check", GUILD, formId)))
                .andExpect(jsonPath("$.errors.length()").value(0))
                .andExpect(jsonPath("$.warnings[0].area").value("notifications"));

        mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms/{f}/publish-changes", GUILD, formId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasUnpublishedChanges").value(false))
                .andExpect(jsonPath("$.status").value("PUBLISHED"));
        mvc.perform(get("/api/v1/public/forms/{s}", slug))
                .andExpect(jsonPath("$.schema.fields.length()").value(2));

        // A change undone leaves nothing unpublished; discarding drops a draft.
        mvc.perform(as(owner, delete("/api/v1/forms/{f}/fields/{id}", formId, "age"))).andExpect(status().isOk());
        mvc.perform(as(owner, delete("/api/v1/guilds/{g}/forms/{f}/draft", GUILD, formId)))
                .andExpect(jsonPath("$.hasUnpublishedChanges").value(false))
                .andExpect(jsonPath("$.schema.fields.length()").value(2));
    }

    @Test
    void publishingListsWhatIsWrongByField() throws Exception {
        String formId = createDraft(GUILD);
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}/settings", GUILD, formId))
                .content("{\"accessMode\": \"ROLE_GATED\", \"allowedRoleIds\": [\"5\"], \"deniedRoleIds\": []}"));
        // A role gate emptied directly in the database stands for an old form with no roles left.
        var form = formRepository.findById(java.util.UUID.fromString(formId)).orElseThrow();
        form.getAllowedRoleIds().clear();
        formRepository.save(form);
        mvc.perform(as(owner, get("/api/v1/guilds/{g}/forms/{f}/publish-check", GUILD, formId)))
                .andExpect(jsonPath("$.errors[?(@.area == 'fields')]").exists())
                .andExpect(jsonPath("$.errors[?(@.area == 'access')]").exists());
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms/{f}/publish", GUILD, formId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.access").exists());
    }
}
