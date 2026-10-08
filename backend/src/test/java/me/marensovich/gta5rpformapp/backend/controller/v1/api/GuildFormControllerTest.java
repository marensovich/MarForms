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
                .andExpect(status().isConflict());

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
    void aFormFromAnotherGuildIsNotFoundEvenForAnOwnerOfBoth() throws Exception {
        String otherForm = createDraft(OTHER_GUILD);

        mvc.perform(as(owner, get("/api/v1/guilds/{g}/forms/{f}", GUILD, otherForm))).andExpect(status().isNotFound());
        mvc.perform(as(owner, delete("/api/v1/guilds/{g}/forms/{f}", GUILD, otherForm))).andExpect(status().isNotFound());
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
    void stage2AccessModesAreRejected() throws Exception {
        String formId = createDraft(GUILD);

        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}/settings", GUILD, formId))
                        .content("{\"accessMode\": \"ANONYMOUS\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(as(owner, put("/api/v1/guilds/{g}/forms/{f}/settings", GUILD, formId))
                        .content("{\"accessMode\": \"OPEN\", \"submissionLimitPerUser\": 1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessMode").value("OPEN"))
                .andExpect(jsonPath("$.submissionLimitPerUser").value(1));
    }

    @Test
    void aPublishedFormMustKeepAtLeastOneInputField() throws Exception {
        String formId = createDraft(GUILD);
        mvc.perform(as(owner, post("/api/v1/forms/{f}/fields", formId))
                .content("{\"id\": \"only\", \"type\": \"TEXT\", \"label\": \"Only\"}"));
        mvc.perform(as(owner, post("/api/v1/guilds/{g}/forms/{f}/publish", GUILD, formId))).andExpect(status().isOk());

        mvc.perform(as(owner, delete("/api/v1/forms/{f}/fields/{id}", formId, "only")))
                .andExpect(status().isConflict());
    }
}
