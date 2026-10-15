package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormField;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.data.guilds.GuildRole;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.entity.GuildMembership;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildMembershipRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A submission is read by the questions it answered, not the form as edited
 * since (#117, ТЗ ФТ-5.3.7).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SubmissionSnapshotTest {

    private static final long GUILD = 6201L;

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private GuildRepository guildRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private GuildMembershipRepository guildMembershipRepository;
    @Autowired
    private FormRepository formRepository;

    @Test
    void renamingAndRemovingAFieldLeavesEarlierSubmissionsAsTheyWere() throws Exception {
        Guild guild = new Guild();
        guild.setDiscordGuildId(GUILD);
        guild.setName("Snapshot guild");
        guild = guildRepository.save(guild);
        User owner = new User();
        owner.setDiscordId(62L);
        owner.setDiscordUsername("owner");
        owner = userRepository.save(owner);
        GuildMembership membership = new GuildMembership();
        membership.setUser(owner);
        membership.setGuild(guild);
        membership.setRole(GuildRole.OWNER);
        guildMembershipRepository.save(membership);

        FormSchema schema = new FormSchema();
        schema.setTitle("Набор");
        schema.setFields(new ArrayList<>(List.of(field("nick", "Ник"), field("tag", "Discord-тег"))));
        Form form = new Form();
        form.setServerId(GUILD);
        form.setSchema(schema);
        form.setStatus(FormStatus.PUBLISHED);
        form.setAccessMode(FormAccessMode.OPEN);
        form.setSlug("snapshot-form");
        form = formRepository.saveAndFlush(form);

        String body = mvc.perform(post("/api/v1/public/forms/{s}/submissions", "snapshot-form")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answers\": {\"nick\": \"Dmitry\", \"tag\": \"dmitry#0001\"}}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String id = objectMapper.readTree(body).get("id").asText();

        // The owner renames one question and removes the other.
        FormSchema edited = new FormSchema();
        edited.setTitle("Набор");
        edited.setFields(new ArrayList<>(List.of(field("nick", "Имя персонажа"))));
        form.setSchema(edited);
        formRepository.saveAndFlush(form);

        mvc.perform(get("/api/v1/submissions/{id}", id)
                        .header("Authorization", "Bearer " + jwtUtil.generateToken(owner.getDiscordId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.schema.fields.length()").value(2))
                .andExpect(jsonPath("$.schema.fields[0].label").value("Ник"))
                .andExpect(jsonPath("$.schema.fields[1].label").value("Discord-тег"))
                .andExpect(jsonPath("$.submission.answers.tag").value("dmitry#0001"));
    }

    private static FormField field(String id, String label) {
        FormField f = new FormField();
        f.setId(id);
        f.setType(FormField.FieldType.TEXT);
        f.setLabel(label);
        return f;
    }
}
