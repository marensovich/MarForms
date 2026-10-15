package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.Role;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.RoleRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.SubmissionRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * ⌘K search (#107): hits only from what the caller may open.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SearchControllerTest {

    private static final long GUILD_A = 7101L;
    private static final long GUILD_B = 7102L;

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private GuildRepository guildRepository;
    @Autowired
    private GuildMembershipRepository guildMembershipRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private SubmissionRepository submissionRepository;

    private User moderatorA;
    private User admin;
    private User respondent;

    @BeforeEach
    void setUp() {
        Guild a = guild(GUILD_A, "Los Santos RP");
        Guild b = guild(GUILD_B, "Vinewood RP");
        moderatorA = user(10L, "kirill_nv");
        membership(moderatorA, a, GuildRole.MODERATOR);
        admin = user(11L, "platform_admin", Permission.DASHBOARD_ACCESS, Permission.FORMS_MANAGE,
                Permission.RESPONSES_MANAGE, Permission.USERS_MODERATE);
        respondent = user(12L, "dmitry_ballas");

        Form lspdA = form(GUILD_A, "Набор в LSPD", "lspd-academy");
        Form lspdB = form(GUILD_B, "Набор в LSPD Vinewood", "lspd-vinewood");
        form(GUILD_A, "Набор в EMS", "ems");
        submission(lspdA, respondent.getDiscordId());
        submission(lspdB, respondent.getDiscordId());
        submission(lspdA, null); // anonymous
    }

    @Test
    void aServerModeratorFindsOnlyTheirServersFormsAndSubmissions() throws Exception {
        search(moderatorA, "lspd")
                .andExpect(jsonPath("$.forms", hasSize(1)))
                .andExpect(jsonPath("$.forms[0].slug").value("lspd-academy"))
                .andExpect(jsonPath("$.forms[0].guildName").value("Los Santos RP"))
                .andExpect(jsonPath("$.forms[0].workspace").value(true))
                .andExpect(jsonPath("$.users", hasSize(0)));

        search(moderatorA, "dmitry")
                .andExpect(jsonPath("$.submissions", hasSize(1)))
                .andExpect(jsonPath("$.submissions[0].formTitle").value("Набор в LSPD"))
                .andExpect(jsonPath("$.submissions[0].authorName").value("dmitry_ballas"))
                .andExpect(jsonPath("$.submissions[0].guildId").value(String.valueOf(GUILD_A)));
    }

    @Test
    void platformPermissionsWidenTheSearchToEveryServer() throws Exception {
        search(admin, "lspd")
                .andExpect(jsonPath("$.forms[*].slug", containsInAnyOrder("lspd-academy", "lspd-vinewood")))
                .andExpect(jsonPath("$.forms[0].workspace").value(false));
        search(admin, "dmitry")
                .andExpect(jsonPath("$.submissions", hasSize(2)))
                .andExpect(jsonPath("$.users[0].username").value("dmitry_ballas"))
                .andExpect(jsonPath("$.users[0].discordId").value("12"));
    }

    @Test
    void aDiscordIdFindsTheUserExactly() throws Exception {
        search(admin, "12")
                .andExpect(jsonPath("$.users", hasSize(1)))
                .andExpect(jsonPath("$.submissions", hasSize(2)));
    }

    @Test
    void aRespondentFindsNothing() throws Exception {
        search(respondent, "lspd")
                .andExpect(jsonPath("$.forms", hasSize(0)))
                .andExpect(jsonPath("$.submissions", hasSize(0)))
                .andExpect(jsonPath("$.users", hasSize(0)));
    }

    @Test
    void shortQueriesAndLikeWildcardsMatchNothingBroad() throws Exception {
        search(admin, "l").andExpect(jsonPath("$.forms", hasSize(0)));
        search(admin, "%%").andExpect(jsonPath("$.forms", hasSize(0)));
        search(admin, "__").andExpect(jsonPath("$.forms", hasSize(0)));
    }

    @Test
    void anonymousCallersAreRejected() throws Exception {
        mvc.perform(get("/api/v1/search").param("q", "lspd")).andExpect(status().isUnauthorized());
    }

    private ResultActions search(User user, String q) throws Exception {
        return mvc.perform(get("/api/v1/search").param("q", q)
                        .header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId())))
                .andExpect(status().isOk());
    }

    private Guild guild(long id, String name) {
        Guild g = new Guild();
        g.setDiscordGuildId(id);
        g.setName(name);
        return guildRepository.save(g);
    }

    private User user(long discordId, String name, Permission... permissions) {
        User u = new User();
        u.setDiscordId(discordId);
        u.setDiscordUsername(name);
        if (permissions.length > 0) {
            Role role = new Role();
            role.setName("role-" + discordId);
            role.setPermissions(new HashSet<>(Set.of(permissions)));
            u.getRoles().add(roleRepository.save(role));
        }
        return userRepository.save(u);
    }

    private void membership(User user, Guild guild, GuildRole role) {
        GuildMembership m = new GuildMembership();
        m.setUser(user);
        m.setGuild(guild);
        m.setRole(role);
        guildMembershipRepository.save(m);
    }

    private Form form(long guildId, String title, String slug) {
        FormSchema schema = new FormSchema();
        schema.setTitle(title);
        Form form = new Form();
        form.setServerId(guildId);
        form.setSchema(schema);
        form.setStatus(FormStatus.PUBLISHED);
        form.setSlug(slug);
        return formRepository.save(form);
    }

    private void submission(Form form, Long discordId) {
        Submission s = new Submission();
        s.setFormId(form.getId());
        s.setDiscordId(discordId);
        s.setAnswers(Map.of("q", "a"));
        submissionRepository.save(s);
    }
}
