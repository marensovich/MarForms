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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * File attachments (E3.2): upload, submit with the file ID, the moderator
 * downloads it; limits and misuse are refused.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class FileUploadTest {

    private static final long GUILD = 8301L;

    @TempDir
    static Path uploads;

    @DynamicPropertySource
    static void filesDir(DynamicPropertyRegistry registry) {
        registry.add("app.files.dir", () -> uploads.toString());
    }

    @Autowired
    private MockMvc mvc;
    @Autowired
    private me.marensovich.gta5rpformapp.backend.service.files.FileService fileService;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private GuildRepository guildRepository;
    @Autowired
    private GuildMembershipRepository guildMembershipRepository;

    private User moderator;

    @BeforeEach
    void setUp() {
        Guild guild = new Guild();
        guild.setDiscordGuildId(GUILD);
        guild.setName("Guild");
        guildRepository.save(guild);
        moderator = new User();
        moderator.setDiscordId(1L);
        moderator.setDiscordUsername("mod");
        moderator = userRepository.save(moderator);
        GuildMembership m = new GuildMembership();
        m.setUser(moderator);
        m.setGuild(guild);
        m.setRole(GuildRole.MODERATOR);
        guildMembershipRepository.save(m);

        FormField cv = new FormField();
        cv.setId("cv");
        cv.setType(FormField.FieldType.FILE_UPLOAD);
        cv.setLabel("CV");
        cv.setRequired(true);
        cv.setAllowedExtensions(List.of("pdf", ".TXT"));
        cv.setMaxFileSizeMb(1);
        FormField name = new FormField();
        name.setId("name");
        name.setType(FormField.FieldType.TEXT);
        name.setLabel("Name");
        FormSchema schema = new FormSchema();
        schema.setTitle("Application");
        schema.setFields(new ArrayList<>(List.of(name, cv)));
        Form form = new Form();
        form.setServerId(GUILD);
        form.setSchema(schema);
        form.setAccessMode(FormAccessMode.OPEN);
        form.setStatus(FormStatus.PUBLISHED);
        form.setSlug("files-form");
        formRepository.save(form);
    }

    private String upload(String fieldId, String fileName, byte[] bytes) throws Exception {
        return mvc.perform(multipart("/api/v1/public/forms/{s}/files", "files-form")
                        .file(new MockMultipartFile("file", fileName, "text/plain", bytes))
                        .param("fieldId", fieldId))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
    }

    private String submit(String fileId) throws Exception {
        return mvc.perform(post("/api/v1/public/forms/{s}/submissions", "files-form")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answers\": {\"name\": \"Bob\", \"cv\": \"" + fileId + "\"}}"))
                .andReturn().getResponse().getContentAsString();
    }

    @Test
    void anUploadedFileIsAttachedAndTheModeratorCanDownloadIt() throws Exception {
        String body = upload("cv", "../../etc/My CV.txt", "hello".getBytes(StandardCharsets.UTF_8));
        String fileId = objectMapper.readTree(body).get("id").asText();
        String submissionId = objectMapper.readTree(submit(fileId)).get("id").asText();

        mvc.perform(get("/api/v1/submissions/{id}", submissionId)
                        .header("Authorization", "Bearer " + jwtUtil.generateToken(moderator.getDiscordId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.submission.answers.cv").value(fileId))
                .andExpect(jsonPath("$.files[0].name").value("My CV.txt"))
                .andExpect(jsonPath("$.files[0].size").value(5));

        mvc.perform(get("/api/v1/files/{id}", fileId)
                        .header("Authorization", "Bearer " + jwtUtil.generateToken(moderator.getDiscordId())))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("attachment")))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(content().bytes("hello".getBytes(StandardCharsets.UTF_8)));

        // A file can't be reused for a second submission.
        mvc.perform(post("/api/v1/public/forms/{s}/submissions", "files-form")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answers\": {\"cv\": \"" + fileId + "\"}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.cv").value("Upload the file again"));
    }

    @Test
    void aFormsPendingUploadsAreCapped() throws Exception {
        // 1 MB quota: one ~0.6 MB upload fits, the second doesn't (#103).
        ReflectionTestUtils.setField(fileService, "pendingQuotaMb", 1L);
        try {
            upload("cv", "a.txt", new byte[600 * 1024]);
            mvc.perform(multipart("/api/v1/public/forms/{s}/files", "files-form")
                            .file(new MockMultipartFile("file", "b.txt", "text/plain", new byte[600 * 1024]))
                            .param("fieldId", "cv"))
                    .andExpect(status().isTooManyRequests());
        } finally {
            ReflectionTestUtils.setField(fileService, "pendingQuotaMb", 1024L);
        }
    }

    @Test
    void limitsAreEnforced() throws Exception {
        mvc.perform(multipart("/api/v1/public/forms/{s}/files", "files-form")
                        .file(new MockMultipartFile("file", "run.exe", "application/octet-stream", new byte[]{1}))
                        .param("fieldId", "cv"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.cv").value("Allowed file types: pdf, txt"));
        mvc.perform(multipart("/api/v1/public/forms/{s}/files", "files-form")
                        .file(new MockMultipartFile("file", "big.pdf", "application/pdf", new byte[1024 * 1024 + 1]))
                        .param("fieldId", "cv"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.cv").value("The file is larger than 1 MB"));
        mvc.perform(multipart("/api/v1/public/forms/{s}/files", "files-form")
                        .file(new MockMultipartFile("file", "a.pdf", "application/pdf", new byte[]{1}))
                        .param("fieldId", "name"))
                .andExpect(status().isNotFound());
    }

    @Test
    void anUnattachedOrUnknownFileCannotBeDownloadedOrSubmittedAsAnother() throws Exception {
        String fileId = objectMapper.readTree(upload("cv", "a.pdf", new byte[]{1})).get("id").asText();
        mvc.perform(get("/api/v1/files/{id}", fileId)
                        .header("Authorization", "Bearer " + jwtUtil.generateToken(moderator.getDiscordId())))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/public/forms/{s}/submissions", "files-form")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"answers\": {\"cv\": \"00000000-0000-0000-0000-000000000000\"}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.cv").value("Upload the file again"));
    }
}
