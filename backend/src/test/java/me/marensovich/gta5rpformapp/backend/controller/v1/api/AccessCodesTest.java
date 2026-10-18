package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.BanListEntry;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.BanListRepository;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Every access code of ТЗ 3.5 (#110): the form page reports it with its
 * details, and a submission is refused with the same code.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AccessCodesTest {

    private static final long GUILD = 8801L;
    private static final long CITIZEN = 501L, BLACKLIST = 502L;

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
    @Autowired
    private BanListRepository banListRepository;

    private Guild guild;
    private User member;
    private User outsider;

    @BeforeEach
    void setUp() {
        guild = new Guild();
        guild.setDiscordGuildId(GUILD);
        guild.setName("Los Santos RP");
        guild = guildRepository.save(guild);
        member = user(31L, true);
        outsider = user(32L, false);
    }

    @Test
    void granted() throws Exception {
        form("ok", FormStatus.PUBLISHED, FormAccessMode.AUTHENTICATED);
        page(member, "ok").andExpect(jsonPath("$.viewerAccess").value("GRANTED"))
                .andExpect(jsonPath("$.access").isEmpty());
    }

    @Test
    void authRequired() throws Exception {
        form("auth", FormStatus.PUBLISHED, FormAccessMode.AUTHENTICATED);
        page(null, "auth").andExpect(jsonPath("$.viewerAccess").value("AUTH_REQUIRED"));
        submit(null, "auth").andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));
    }

    @Test
    void notGuildMember() throws Exception {
        form("members", FormStatus.PUBLISHED, FormAccessMode.AUTHENTICATED);
        page(outsider, "members").andExpect(jsonPath("$.viewerAccess").value("NOT_GUILD_MEMBER"));
        submit(outsider, "members").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("NOT_GUILD_MEMBER"));
    }

    @Test
    void guildBannedWithReason() throws Exception {
        form("banned", FormStatus.PUBLISHED, FormAccessMode.AUTHENTICATED);
        BanListEntry ban = new BanListEntry();
        ban.setGuildId(GUILD);
        ban.setDiscordId(member.getDiscordId());
        ban.setReason("Нарушение правил NonRP");
        banListRepository.save(ban);
        page(member, "banned").andExpect(jsonPath("$.viewerAccess").value("GUILD_BANNED"))
                .andExpect(jsonPath("$.access.reason").value("Нарушение правил NonRP"))
                .andExpect(jsonPath("$.access.since", notNullValue()));
        submit(member, "banned").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("GUILD_BANNED"));
    }

    @Test
    void roleRequiredListsTheAllowedRoles() throws Exception {
        Form form = roleGated("citizens", Set.of(CITIZEN), Set.of());
        roles(member, List.of(BLACKLIST + 100));
        page(member, form.getSlug()).andExpect(jsonPath("$.viewerAccess").value("ROLE_REQUIRED"))
                .andExpect(jsonPath("$.access.roles", hasSize(1)))
                .andExpect(jsonPath("$.access.roles[0].id").value(String.valueOf(CITIZEN)));
    }

    @Test
    void roleDeniedNamesTheViewersDeniedRoleEvenWithAnAllowedOne() throws Exception {
        Form form = roleGated("no-blacklist", Set.of(CITIZEN), Set.of(BLACKLIST));
        roles(member, List.of(CITIZEN, BLACKLIST));
        page(member, form.getSlug()).andExpect(jsonPath("$.viewerAccess").value("ROLE_DENIED"))
                .andExpect(jsonPath("$.access.roles[0].id").value(String.valueOf(BLACKLIST)));
        submit(member, form.getSlug()).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ROLE_DENIED"));
    }

    @Test
    void roleCheckFailedWhenRolesAreUnknown() throws Exception {
        Form form = roleGated("unknown-roles", Set.of(CITIZEN), Set.of());
        page(member, form.getSlug()).andExpect(jsonPath("$.viewerAccess").value("ROLE_CHECK_FAILED"));
    }

    @Test
    void notOpenYetGivesTheOpeningTime() throws Exception {
        Form form = form("soon", FormStatus.PUBLISHED, FormAccessMode.AUTHENTICATED);
        form.setOpensAt(LocalDateTime.now().plusDays(2));
        formRepository.save(form);
        page(member, "soon").andExpect(jsonPath("$.viewerAccess").value("NOT_OPEN_YET"))
                .andExpect(jsonPath("$.access.opensAt", notNullValue()));
        submit(member, "soon").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_OPEN_YET"));
    }

    @Test
    void formClosedByStaffOrByItsDeadline() throws Exception {
        form("closed", FormStatus.CLOSED, FormAccessMode.AUTHENTICATED);
        page(member, "closed").andExpect(jsonPath("$.viewerAccess").value("FORM_CLOSED"));

        Form late = form("late", FormStatus.PUBLISHED, FormAccessMode.AUTHENTICATED);
        late.setClosesAt(LocalDateTime.now().minusDays(1));
        formRepository.save(late);
        page(member, "late").andExpect(jsonPath("$.viewerAccess").value("FORM_CLOSED"))
                .andExpect(jsonPath("$.access.closesAt", notNullValue()));
        submit(member, "late").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("FORM_CLOSED"));
    }

    @Test
    void formStatusComesBeforeLogin() throws Exception {
        form("archived", FormStatus.ARCHIVED, FormAccessMode.AUTHENTICATED);
        page(null, "archived").andExpect(jsonPath("$.viewerAccess").value("FORM_ARCHIVED"));
    }

    @Test
    void formNotFoundForUnknownSlugsAndDrafts() throws Exception {
        form("draft", FormStatus.DRAFT, FormAccessMode.AUTHENTICATED);
        mvc.perform(get("/api/v1/public/forms/{s}", "nope")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("FORM_NOT_FOUND"));
        mvc.perform(get("/api/v1/public/forms/{s}", "draft")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("FORM_NOT_FOUND"));
    }

    @Test
    void limitReachedPointsToThePreviousSubmission() throws Exception {
        Form form = form("once", FormStatus.PUBLISHED, FormAccessMode.AUTHENTICATED);
        form.setSubmissionLimitPerUser(1);
        formRepository.save(form);
        Submission earlier = new Submission();
        earlier.setFormId(form.getId());
        earlier.setDiscordId(member.getDiscordId());
        earlier.setAnswers(Map.of());
        earlier = submissionRepository.save(earlier);

        page(member, "once").andExpect(jsonPath("$.viewerAccess").value("LIMIT_REACHED"))
                .andExpect(jsonPath("$.access.previousSubmissionId").value(earlier.getId().toString()));
        submit(member, "once").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LIMIT_REACHED"))
                .andExpect(jsonPath("$.details.previousSubmissionId").value(earlier.getId().toString()));
    }

    @Test
    void aBanComesFromTheAuthFilter() throws Exception {
        form("any", FormStatus.PUBLISHED, FormAccessMode.AUTHENTICATED);
        member.setBannedPermanently(true);
        member.setRestrictionReason("Читы");
        userRepository.save(member);
        mvc.perform(as(member, get("/api/v1/public/forms/{s}", "any"))).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_RESTRICTED"))
                .andExpect(jsonPath("$.permanent").value(true))
                .andExpect(jsonPath("$.reason").value("Читы"));
    }

    @Test
    void aTimedOutUserSeesTheFormButCantSendWithTheEndAndTheReason() throws Exception {
        form("any", FormStatus.PUBLISHED, FormAccessMode.AUTHENTICATED);
        member.setBannedUntil(LocalDateTime.now().plusHours(3));
        member.setRestrictionReason("Спам");
        userRepository.save(member);
        page(member, "any").andExpect(jsonPath("$.viewerAccess").value("ACCOUNT_RESTRICTED"))
                .andExpect(jsonPath("$.access.until", notNullValue()))
                .andExpect(jsonPath("$.access.reason").value("Спам"));
        submit(member, "any").andExpect(status().is4xxClientError())
                .andExpect(jsonPath("$.code").value("ACCOUNT_RESTRICTED"));
    }

    private ResultActions page(User user, String slug) throws Exception {
        return mvc.perform(as(user, get("/api/v1/public/forms/{s}", slug))).andExpect(status().isOk());
    }

    private ResultActions submit(User user, String slug) throws Exception {
        return mvc.perform(as(user, post("/api/v1/public/forms/{s}/submissions", slug)).content("{\"answers\": {}}"));
    }

    private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
        request.contentType(MediaType.APPLICATION_JSON);
        return user == null ? request : request.header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId()));
    }

    private User user(long discordId, boolean memberOfGuild) {
        User u = new User();
        u.setDiscordId(discordId);
        u.setDiscordUsername("user" + discordId);
        if (memberOfGuild) u.getGuildIds().add(GUILD);
        return userRepository.save(u);
    }

    private void roles(User user, List<Long> roleIds) {
        GuildMembership m = new GuildMembership();
        m.setUser(user);
        m.setGuild(guild);
        m.setRole(GuildRole.RESPONDENT);
        m.setDiscordRoles(new ArrayList<>(roleIds));
        m.setDiscordRolesSyncedAt(LocalDateTime.now());
        guildMembershipRepository.save(m);
    }

    private Form form(String slug, FormStatus status, FormAccessMode mode) {
        FormSchema schema = new FormSchema();
        schema.setTitle("Набор в LSPD");
        Form form = new Form();
        form.setServerId(GUILD);
        form.setSchema(schema);
        form.setStatus(status);
        form.setAccessMode(mode);
        form.setSlug(slug);
        return formRepository.save(form);
    }

    private Form roleGated(String slug, Set<Long> allowed, Set<Long> denied) {
        Form form = form(slug, FormStatus.PUBLISHED, FormAccessMode.ROLE_GATED);
        form.getAllowedRoleIds().addAll(allowed);
        form.getDeniedRoleIds().addAll(denied);
        return formRepository.save(form);
    }
}
