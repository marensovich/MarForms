package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import me.marensovich.gta5rpformapp.backend.data.forms.FormAccessMode;
import me.marensovich.gta5rpformapp.backend.data.forms.FormSchema;
import me.marensovich.gta5rpformapp.backend.data.forms.FormStatus;
import me.marensovich.gta5rpformapp.backend.database.entity.Form;
import me.marensovich.gta5rpformapp.backend.database.entity.Guild;
import me.marensovich.gta5rpformapp.backend.database.repository.FormRepository;
import me.marensovich.gta5rpformapp.backend.database.repository.GuildRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Short submission numbers run per server across its forms (#114).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SubmissionNumberTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private GuildRepository guildRepository;
    @Autowired
    private FormRepository formRepository;

    @BeforeEach
    void setUp() {
        guild(6101L);
        guild(6102L);
        form(6101L, "a-one");
        form(6101L, "a-two");
        form(6102L, "b-one");
    }

    @Test
    void numbersRunPerServerAcrossItsForms() throws Exception {
        submit("a-one").andExpect(jsonPath("$.number").value(1));
        submit("a-two").andExpect(jsonPath("$.number").value(2));
        submit("b-one").andExpect(jsonPath("$.number").value(1));
        submit("a-one").andExpect(jsonPath("$.number").value(3));
    }

    @Test
    void theFormPageNamesItsServerAndReviewTime() throws Exception {
        mvc.perform(get("/api/v1/public/forms/{s}", "a-one")).andExpect(status().isOk())
                .andExpect(jsonPath("$.guildId").value("6101"))
                .andExpect(jsonPath("$.schema.reviewTime").value("обычно 1–2 дня"));
    }

    private ResultActions submit(String slug) throws Exception {
        return mvc.perform(post("/api/v1/public/forms/{s}/submissions", slug)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"answers\": {}}"))
                .andExpect(status().isCreated());
    }

    private void guild(long id) {
        Guild g = new Guild();
        g.setDiscordGuildId(id);
        g.setName("Guild " + id);
        guildRepository.save(g);
    }

    private void form(long guildId, String slug) {
        FormSchema schema = new FormSchema();
        schema.setTitle("Набор");
        schema.setReviewTime("обычно 1–2 дня");
        Form form = new Form();
        form.setServerId(guildId);
        form.setSchema(schema);
        form.setStatus(FormStatus.PUBLISHED);
        form.setAccessMode(FormAccessMode.ANONYMOUS);
        form.setSlug(slug);
        formRepository.save(form);
    }
}
