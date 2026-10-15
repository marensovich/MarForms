package me.marensovich.gta5rpformapp.backend.service.export;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * CSV export (E3.3, #87).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CsvExportServiceTest {

    private static final long GUILD = 8401L;

    @Autowired
    private CsvExportService csvExportService;
    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private SubmissionRepository submissionRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private GuildRepository guildRepository;
    @Autowired
    private GuildMembershipRepository guildMembershipRepository;

    private Form form;
    private User owner;
    private User moderator;

    private static FormField field(String id, FormField.FieldType type, String label) {
        FormField f = new FormField();
        f.setId(id);
        f.setType(type);
        f.setLabel(label);
        return f;
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

    @BeforeEach
    void setUp() {
        Guild guild = new Guild();
        guild.setDiscordGuildId(GUILD);
        guild.setName("Guild");
        guild = guildRepository.save(guild);
        owner = user(1L, "owner", guild, GuildRole.OWNER);
        moderator = user(2L, "mod", guild, GuildRole.MODERATOR);
        user(3L, "alice", guild, GuildRole.RESPONDENT);

        FormSchema schema = new FormSchema();
        schema.setTitle("Application");
        schema.setFields(new ArrayList<>(List.of(
                field("nick", FormField.FieldType.TEXT, "Nick, name"),
                field("intro", FormField.FieldType.SECTION_BREAK, "About you"),
                field("roles", FormField.FieldType.MULTI_SELECT, "Roles"),
                field("adult", FormField.FieldType.BOOLEAN, "18+"),
                field("age", FormField.FieldType.NUMBER, "Age"))));
        form = new Form();
        form.setServerId(GUILD);
        form.setSchema(schema);
        form.setStatus(FormStatus.PUBLISHED);
        form.setSlug("export-form");
        form = formRepository.save(form);

        Map<String, Object> answers = new LinkedHashMap<>();
        answers.put("nick", "=HYPERLINK(\"http://evil\")");
        answers.put("roles", List.of("Police", "Medic"));
        answers.put("adult", true);
        answers.put("age", -5);
        Submission s = new Submission();
        s.setFormId(form.getId());
        s.setDiscordId(3L);
        s.setAnswers(answers);
        s.setStatus(SubmissionStatus.APPROVED);
        s.setModeratorComment("Line one\nline two");
        submissionRepository.save(s);

        Submission anonymous = new Submission();
        anonymous.setFormId(form.getId());
        anonymous.setAnswers(Map.of("nick", "Bob"));
        submissionRepository.save(anonymous);
    }

    @Test
    void writesEveryInputFieldAsAColumnSafely() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        csvExportService.write(form, out);
        String csv = out.toString(StandardCharsets.UTF_8);

        assertThat(csv).startsWith("﻿");
        String[] lines = csv.substring(1).split("\r\n");
        assertThat(lines[0]).isEqualTo(
                "Submission ID,Submitted at,Status,Discord ID,Username,\"Nick, name\",Roles,18+,Age,Moderator comment,Decided at");
        String alice = csv.substring(csv.indexOf(",APPROVED,"));
        // A formula is neutralised, a negative number is kept, multi-values are joined.
        assertThat(alice).startsWith(",APPROVED,3,alice,\"'=HYPERLINK(\"\"http://evil\"\")\",Police; Medic,yes,-5,\"Line one\nline two\",");
        assertThat(csv).contains(",PENDING,,,Bob,,,,,");
    }

    @Test
    void aFieldRemovedFromTheFormStaysAColumnUnderItsOldLabel() throws Exception {
        // An earlier submission was asked "Discord tag", since removed (#117).
        FormSchema then = new FormSchema();
        then.setTitle("Application");
        then.setFields(new ArrayList<>(List.of(
                field("nick", FormField.FieldType.TEXT, "Nick, name"),
                field("tag", FormField.FieldType.TEXT, "Discord tag"))));
        Submission old = new Submission();
        old.setFormId(form.getId());
        old.setDiscordId(3L);
        old.setAnswers(Map.of("nick", "Old", "tag", "old#0001"));
        old.setSchemaSnapshot(then);
        submissionRepository.save(old);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        csvExportService.write(form, out);
        String[] lines = out.toString(StandardCharsets.UTF_8).substring(1).split("\r\n");

        assertThat(lines[0]).isEqualTo("Submission ID,Submitted at,Status,Discord ID,Username,\"Nick, name\",Roles,18+,Age,"
                + "Discord tag,Moderator comment,Decided at");
        assertThat(lines).anyMatch(l -> l.contains(",alice,Old,,,,old#0001,"));
    }

    @Test
    void onlyTheOwnerMayExport() throws Exception {
        mvc.perform(get("/api/v1/forms/{f}/export", form.getId())
                        .header("Authorization", "Bearer " + jwtUtil.generateToken(moderator.getDiscordId())))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/forms/{f}/export", form.getId()).param("format", "xlsx")
                        .header("Authorization", "Bearer " + jwtUtil.generateToken(owner.getDiscordId())))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/forms/{f}/export", form.getId())
                        .header("Authorization", "Bearer " + jwtUtil.generateToken(owner.getDiscordId())))
                .andExpect(request().asyncStarted());
    }
}
