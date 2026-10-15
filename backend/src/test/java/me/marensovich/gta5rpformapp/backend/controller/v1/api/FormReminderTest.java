package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.FormReminderRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient;
import me.marensovich.gta5rpformapp.backend.service.discord.DiscordBotClient.DmResult;
import me.marensovich.gta5rpformapp.backend.service.forms.FormReminderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * «Напомнить в Discord» (#121).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class FormReminderTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FormRepository formRepository;
    @Autowired
    private FormReminderRepository reminderRepository;
    @Autowired
    private FormReminderService reminderService;
    @MockitoBean
    private DiscordBotClient botClient;

    private User user;
    private Form form;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setDiscordId(71L);
        user.setDiscordUsername("waiting");
        user = userRepository.save(user);

        FormSchema schema = new FormSchema();
        schema.setTitle("Набор в LSPD");
        form = new Form();
        form.setServerId(7101L);
        form.setSchema(schema);
        form.setStatus(FormStatus.PUBLISHED);
        form.setAccessMode(FormAccessMode.OPEN);
        form.setOpensAt(LocalDateTime.now().plusDays(1));
        form.setSlug("reminder-form");
        form = formRepository.saveAndFlush(form);
    }

    @Test
    void aSignedInUserSubscribesOnceAndSeesIt() throws Exception {
        String jwt = "Bearer " + jwtUtil.generateToken(user.getDiscordId());
        mvc.perform(post("/api/v1/public/forms/{s}/reminders", "reminder-form")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/public/forms/{s}/reminders", "reminder-form").header("Authorization", jwt))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/v1/public/forms/{s}/reminders", "reminder-form").header("Authorization", jwt))
                .andExpect(status().isNoContent());
        assertThat(reminderRepository.count()).isEqualTo(1);

        mvc.perform(get("/api/v1/public/forms/{s}", "reminder-form").header("Authorization", jwt))
                .andExpect(jsonPath("$.viewerAccess").value("NOT_OPEN_YET"))
                .andExpect(jsonPath("$.reminderSet").value(true));
    }

    @Test
    void anOpenFormTakesNoReminder() throws Exception {
        form.setOpensAt(null);
        formRepository.saveAndFlush(form);
        mvc.perform(post("/api/v1/public/forms/{s}/reminders", "reminder-form")
                        .header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId())))
                .andExpect(status().isConflict());
    }

    @Test
    void theBotWritesWhenTheFormOpensFollowingAMovedDate() {
        when(botClient.sendDirectMessage(eq(71L), any())).thenReturn(DmResult.SENT);
        reminderService.subscribe(form, user.getDiscordId());

        // Not yet: the date was moved later, nothing is sent.
        form.setOpensAt(LocalDateTime.now().plusDays(3));
        formRepository.saveAndFlush(form);
        reminderService.sendDue();
        verify(botClient, never()).sendDirectMessage(any(), any());

        form.setOpensAt(LocalDateTime.now().minusMinutes(1));
        formRepository.saveAndFlush(form);
        reminderService.sendDue();
        verify(botClient).sendDirectMessage(eq(71L), any());
        assertThat(reminderRepository.findAll()).singleElement().satisfies(r -> assertThat(r.getSentAt()).isNotNull());

        // Sent once only.
        reminderService.sendDue();
        verify(botClient).sendDirectMessage(eq(71L), any());
    }
}
