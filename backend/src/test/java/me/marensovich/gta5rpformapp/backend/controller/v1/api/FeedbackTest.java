package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.config.JWT.JwtUtil;
import me.marensovich.gta5rpformapp.backend.database.entity.Feedback;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.FeedbackRepository;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** «Обратная связь» (2026-10-19): each kind asks its own questions. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class FeedbackTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FeedbackRepository feedbackRepository;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setDiscordId(9501L);
        user.setDiscordUsername("reporter");
        user = userRepository.save(user);
    }

    private MockHttpServletRequestBuilder send(String body) {
        return post("/api/v1/feedback").header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId()))
                .contentType(MediaType.APPLICATION_JSON).content(body);
    }

    @Test
    void aBugNeedsItsOwnAnswersAndIsKept() throws Exception {
        mvc.perform(send("{\"type\":\"BUG\",\"answers\":{\"title\":\"Кнопка не жмётся\"}}"))
                .andExpect(status().isBadRequest());

        mvc.perform(send("{\"type\":\"BUG\",\"answers\":{\"title\":\"Кнопка не жмётся\",\"steps\":\"Открыть форму\","
                        + "\"actual\":\"Ничего\",\"severity\":\"MINOR\",\"extra\":\"dropped\"},\"page\":\"/dashboard\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.delivered").value(false));

        Feedback kept = feedbackRepository.findAll().getFirst();
        assertThat(kept.getType()).isEqualTo(Feedback.Type.BUG);
        assertThat(kept.getAnswers()).containsEntry("severity", "MINOR").doesNotContainKey("extra");
        assertThat(kept.getAuthorUsername()).isEqualTo("reporter");
    }

    @Test
    void anIdeaAsksOtherQuestionsThanABug() throws Exception {
        mvc.perform(send("{\"type\":\"IDEA\",\"answers\":{\"title\":\"Тёмная тема\",\"problem\":\"Глаза\",\"proposal\":\"Кнопка\"}}"))
                .andExpect(status().isCreated());
        mvc.perform(send("{\"type\":\"BUG\",\"answers\":{\"title\":\"x\",\"steps\":\"y\",\"actual\":\"z\",\"severity\":\"WHATEVER\"}}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void itIsLimitedPerHour() throws Exception {
        String other = "{\"type\":\"OTHER\",\"answers\":{\"subject\":\"Привет\",\"message\":\"Спасибо\"}}";
        for (int i = 0; i < 5; i++) mvc.perform(send(other)).andExpect(status().isCreated());
        mvc.perform(send(other)).andExpect(status().isTooManyRequests());
    }

    @Test
    void onlyThePlatformsAdministratorsSeeTheWebhook() throws Exception {
        mvc.perform(get("/api/v1/settings/feedback").header("Authorization", "Bearer " + jwtUtil.generateToken(user.getDiscordId())))
                .andExpect(status().isForbidden());
    }
}
