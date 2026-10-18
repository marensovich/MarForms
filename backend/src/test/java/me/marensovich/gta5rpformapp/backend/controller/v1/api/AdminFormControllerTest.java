package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.roles.Permission;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.Role;
import me.marensovich.gta5rpformapp.backend.database.entity.Submission;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.RoleRepository;
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

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The platform's forms page (ТЗ 6.1, #142): filters, paging and sorting on
 * the server, KPIs, bulk actions, the CSV and the connected servers.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminFormControllerTest {

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
    private FormRepository formRepository;
    @Autowired
    private SubmissionRepository submissionRepository;

    private User admin;
    private User nobody;
    private Form lspd;
    private Form ems;
    private Form ballas;

    @BeforeEach
    void setUp() {
        guild(8101L, "Los Santos RP");
        guild(8102L, "Vinewood RP");
        admin = user(21L, Permission.DASHBOARD_ACCESS, Permission.FORMS_MANAGE);
        nobody = user(22L);
        lspd = form(8101L, "Набор в LSPD", "lspd-academy", FormStatus.PUBLISHED);
        ems = form(8101L, "Набор в EMS", "ems", FormStatus.CLOSED);
        ballas = form(8102L, "Банда Ballas", "ballas", FormStatus.PUBLISHED);
        for (int i = 0; i < 3; i++) submission(lspd);
        submission(ballas);
    }

    @Test
    void filtersSortsAndPagesOnTheServerWithKpis() throws Exception {
        mvc.perform(as(admin, get("/api/v1/admin/forms").param("status", "active")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.totalElements").value(2));
        mvc.perform(as(admin, get("/api/v1/admin/forms").param("q", "LSPD")))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].guildName").value("Los Santos RP"))
                .andExpect(jsonPath("$.content[0].form.submissionCount").value(3));
        mvc.perform(as(admin, get("/api/v1/admin/forms").param("serverId", "8101").param("sort", "submissions,desc")))
                .andExpect(jsonPath("$.content[0].form.slug").value("lspd-academy"))
                .andExpect(jsonPath("$.content[1].form.slug").value("ems"));
        mvc.perform(as(admin, get("/api/v1/admin/forms").param("size", "2").param("page", "1").param("sort", "title,asc")))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.page.totalPages").value(2));

        mvc.perform(as(admin, get("/api/v1/admin/forms/stats")))
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.active").value(2))
                .andExpect(jsonPath("$.submissions").value(4));
        mvc.perform(as(admin, get("/api/v1/admin/forms/servers")))
                .andExpect(jsonPath("$[0].name").value("Los Santos RP"))
                .andExpect(jsonPath("$[0].forms").value(2))
                .andExpect(jsonPath("$[0].botStatus").value("CONNECTED"));
    }

    @Test
    void bulkDeactivateKeepsTheDataAndBulkDeleteTakesTheSubmissions() throws Exception {
        mvc.perform(as(admin, post("/api/v1/admin/forms/bulk"))
                        .content("{\"ids\": [\"" + lspd.getId() + "\", \"" + ems.getId() + "\"], \"action\": \"DEACTIVATE\"}"))
                .andExpect(jsonPath("$.done").value(1));
        assertThat(formRepository.findById(lspd.getId()).orElseThrow().getStatus()).isEqualTo(FormStatus.CLOSED);
        assertThat(submissionRepository.countByFormId(lspd.getId())).isEqualTo(3);

        mvc.perform(as(admin, post("/api/v1/admin/forms/bulk"))
                        .content("{\"ids\": [\"" + lspd.getId() + "\"], \"action\": \"DELETE\"}"))
                .andExpect(jsonPath("$.done").value(1));
        assertThat(formRepository.findById(lspd.getId())).isEmpty();
        assertThat(submissionRepository.countByFormId(lspd.getId())).isZero();
    }

    @Test
    void theCsvListsTheFilteredFormsAndOnlyFormsManagersGetIn() throws Exception {
        String csv = mvc.perform(as(admin, get("/api/v1/admin/forms/export").param("serverId", "8102")))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(csv).contains("ballas").contains("Vinewood RP").doesNotContain("lspd-academy");

        mvc.perform(as(nobody, get("/api/v1/admin/forms"))).andExpect(status().isForbidden());
        mvc.perform(as(nobody, post("/api/v1/admin/forms/bulk"))
                .content("{\"ids\": [\"" + ems.getId() + "\"], \"action\": \"DELETE\"}")).andExpect(status().isForbidden());
    }

    private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId()))
                .contentType(MediaType.APPLICATION_JSON);
    }

    private void guild(long id, String name) {
        Guild g = new Guild();
        g.setDiscordGuildId(id);
        g.setName(name);
        guildRepository.save(g);
    }

    private User user(long discordId, Permission... permissions) {
        User u = new User();
        u.setDiscordId(discordId);
        u.setDiscordUsername("user" + discordId);
        if (permissions.length > 0) {
            Role role = new Role();
            role.setName("role-" + discordId);
            role.setPermissions(new HashSet<>(Set.of(permissions)));
            u.getRoles().add(roleRepository.save(role));
        }
        return userRepository.save(u);
    }

    private Form form(long guildId, String title, String slug, FormStatus status) {
        FormSchema schema = new FormSchema();
        schema.setTitle(title);
        Form form = new Form();
        form.setServerId(guildId);
        form.setSchema(schema);
        form.setStatus(status);
        form.setSlug(slug);
        return formRepository.save(form);
    }

    private void submission(Form form) {
        Submission s = new Submission();
        s.setFormId(form.getId());
        s.setAnswers(Map.of("q", "a"));
        submissionRepository.save(s);
    }
}
