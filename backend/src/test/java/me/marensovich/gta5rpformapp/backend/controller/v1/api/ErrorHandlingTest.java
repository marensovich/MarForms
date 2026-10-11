package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The catch-all handler keeps framework statuses and answers malformed
 * requests with 400, not 500 (#103).
 */
@SpringBootTest
@AutoConfigureMockMvc
class ErrorHandlingTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void malformedJsonIsABadRequest() throws Exception {
        mvc.perform(post("/api/v1/public/forms/any/submissions").contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Malformed request"));
    }

    @Test
    void anUnknownPathIsStillNotFound() throws Exception {
        mvc.perform(get("/api/v1/public/no-such-endpoint")).andExpect(status().isNotFound());
    }
}
