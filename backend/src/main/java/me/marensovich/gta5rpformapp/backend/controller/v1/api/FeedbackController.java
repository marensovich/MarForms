package me.marensovich.gta5rpformapp.backend.controller.v1.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import me.marensovich.gta5rpformapp.backend.config.security.CustomUserDetails;
import me.marensovich.gta5rpformapp.backend.database.entity.Feedback;
import me.marensovich.gta5rpformapp.backend.database.entity.User;
import me.marensovich.gta5rpformapp.backend.database.repository.UserRepository;
import me.marensovich.gta5rpformapp.backend.service.FeedbackService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * «Обратная связь» (2026-10-19): any signed-in user tells about a bug, an
 * idea or a potential problem of MarForms; the platform's administrators set
 * where it goes.
 *
 * @author marensovich
 * @since v.0.1
 */
@RestController
@RequiredArgsConstructor
public class FeedbackController {

    private final FeedbackService feedbackService;
    private final UserRepository userRepository;

    public record FeedbackRequest(@NotNull Feedback.Type type, @NotNull @Size(max = 10) Map<String, String> answers,
                                  @Size(max = 300) String page) {
    }

    public record FeedbackReceipt(UUID id, boolean delivered) {
    }

    public record WebhookSetting(String webhookUrl) {
    }

    @PostMapping("/api/v1/feedback")
    @ResponseStatus(HttpStatus.CREATED)
    public FeedbackReceipt send(@AuthenticationPrincipal CustomUserDetails principal, @Valid @RequestBody FeedbackRequest request) {
        String username = userRepository.findByDiscordId(principal.getDiscordId()).map(User::getDiscordUsername).orElse(null);
        Feedback saved = feedbackService.submit(principal.getDiscordId(), username, request.type(), request.answers(), request.page());
        return new FeedbackReceipt(saved.getId(), saved.isDelivered());
    }

    @GetMapping("/api/v1/settings/feedback")
    @PreAuthorize("hasAuthority('SYSTEM_ADMIN')")
    public WebhookSetting webhook() {
        return new WebhookSetting(feedbackService.webhookUrl());
    }

    @PutMapping("/api/v1/settings/feedback")
    @PreAuthorize("hasAuthority('SYSTEM_ADMIN')")
    public WebhookSetting setWebhook(@RequestBody WebhookSetting setting) {
        return new WebhookSetting(feedbackService.setWebhookUrl(setting.webhookUrl()));
    }

    @PostMapping("/api/v1/settings/feedback/test")
    @PreAuthorize("hasAuthority('SYSTEM_ADMIN')")
    public Map<String, Boolean> test(@RequestBody(required = false) WebhookSetting setting) {
        return Map.of("ok", feedbackService.test(setting == null ? null : setting.webhookUrl()));
    }
}
