package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The platform's submissions page (ТЗ 6.2, #143): filters by form, dates and
 * user, «заполнено полей», the KPIs and the by-user view.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminSubmissionControllerTest {

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

    @BeforeEach
    void setUp() {
        Guild g = new Guild();
        g.setDiscordGuildId(8201L);
        g.setName("Los Santos RP");
        guildRepository.save(g);
        admin = user(31L, "admin", Permission.DASHBOARD_ACCESS, Permission.RESPONSES_MANAGE);
        nobody = user(32L, "nobody");
        user(412988120773L, "dmitry_ballas");
        user(701122984336L, "kate_wl");
        lspd = form("Набор в LSPD", FormStatus.PUBLISHED);
        ems = form("Набор в EMS", FormStatus.CLOSED);
        submission(lspd, 412988120773L, Map.of("name", "Dmitry", "age", ""), LocalDateTime.of(2026, 10, 15, 14, 2));
        submission(lspd, 701122984336L, Map.of("name", "Kate", "age", "20", "why", "Because"), LocalDateTime.of(2026, 10, 14, 21, 5));
        submission(ems, 701122984336L, Map.of("name", "Kate"), LocalDateTime.of(2026, 9, 1, 10, 0));
    }

    @Test
    void filtersByFormDatesAndUserAndCountsFilledFields() throws Exception {
        mvc.perform(as(admin, get("/api/v1/admin/submissions")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.totalElements").value(3))
                .andExpect(jsonPath("$.content[0].submission.discordUsername").value("dmitry_ballas"))
                .andExpect(jsonPath("$.content[0].submission.formTitle").value("Набор в LSPD"))
                .andExpect(jsonPath("$.content[0].guildName").value("Los Santos RP"))
                .andExpect(jsonPath("$.content[0].answered").value(1))
                .andExpect(jsonPath("$.content[0].fields").value(3));
        mvc.perform(as(admin, get("/api/v1/admin/submissions").param("formId", lspd.getId().toString())
                        .param("from", "2026-10-01").param("to", "2026-10-14")))
                .andExpect(jsonPath("$.page.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].submission.discordId").value("701122984336"));
        mvc.perform(as(admin, get("/api/v1/admin/submissions").param("user", "KATE")))
                .andExpect(jsonPath("$.page.totalElements").value(2));
        mvc.perform(as(admin, get("/api/v1/admin/submissions").param("user", "412988120773")))
                .andExpect(jsonPath("$.page.totalElements").value(1));
        mvc.perform(as(admin, get("/api/v1/admin/submissions").param("user", "nobody-like-this")))
                .andExpect(jsonPath("$.content.length()").value(0));
    }

    @Test
    void kpisAndTheByUserView() throws Exception {
        mvc.perform(as(admin, get("/api/v1/admin/submissions/stats")))
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.forms").value(2))
                .andExpect(jsonPath("$.activeForms").value(1))
                .andExpect(jsonPath("$.users").value(2));
        mvc.perform(as(admin, get("/api/v1/admin/submissions/by-user")))
                .andExpect(jsonPath("$.page.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].username").value("kate_wl"))
                .andExpect(jsonPath("$.content[0].submissions").value(2))
                .andExpect(jsonPath("$.content[0].forms").value(2))
                .andExpect(jsonPath("$.content[0].last").value("2026-10-14T21:05:00"))
                .andExpect(jsonPath("$.content[1].submissions").value(1));
        mvc.perform(as(admin, get("/api/v1/admin/submissions/by-user").param("user", "dmitry")))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].discordId").value("412988120773"));
        mvc.perform(as(nobody, get("/api/v1/admin/submissions/by-user"))).andExpect(status().isForbidden());
        mvc.perform(as(nobody, get("/api/v1/admin/submissions"))).andExpect(status().isForbidden());
    }

    private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId()));
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

    private Form form(String title, FormStatus status) {
        FormSchema schema = new FormSchema();
        schema.setTitle(title);
        List<FormField> fields = new ArrayList<>();
        for (String id : List.of("name", "section", "age", "why")) {
            FormField f = new FormField();
            f.setId(id);
            f.setLabel(id);
            f.setType(id.equals("section") ? FormField.FieldType.SECTION_BREAK : FormField.FieldType.TEXT);
            fields.add(f);
        }
        schema.setFields(fields);
        Form form = new Form();
        form.setServerId(8201L);
        form.setSchema(schema);
        form.setStatus(status);
        return formRepository.save(form);
    }

    private void submission(Form form, long author, Map<String, Object> answers, LocalDateTime at) {
        Submission s = new Submission();
        s.setFormId(form.getId());
        s.setDiscordId(author);
        s.setAnswers(answers);
        s.setCreatedAt(at);
        submissionRepository.save(s);
    }
}
