package me.marensovich.gta5rpformapp.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * «Обновления» (ТЗ 6.6, #147): the latest release on GitHub against the
 * version the server runs. GitHub is asked at most once an hour, unless an
 * administrator presses «Проверить обновления».
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UpdateCheckService {

    static final Duration CACHE = Duration.ofHours(1);
    private static final int NOTES_LIMIT = 300;

    private final RestTemplate restTemplate;
    private final SystemStatusService systemStatusService;

    @Value("${app.updates.repo:marensovich/MarForms}")
    private String repo;
    @Value("${app.updates.api:https://api.github.com}")
    private String api;

    private volatile Updates cached;

    /**
     * What the update check found.
     *
     * @param current   the version the server runs
     * @param latest    the latest release's version, {@code null} if there is none or the check failed
     * @param available the latest is newer than the current one
     * @param notes     the start of the release notes
     * @param url       the release's page
     * @param checkedAt when GitHub was asked
     * @param error     why the check failed, if it did
     */
    public record Updates(String current, String latest, boolean available, String notes, String url,
                          LocalDateTime checkedAt, String error) {
    }

    /**
     * The last check, or a new one if it's older than an hour or forced.
     *
     * @param force ask GitHub now
     * @return the result
     * @since v.0.1
     */
    public Updates check(boolean force) {
        Updates u = cached;
        if (!force && u != null && u.checkedAt().plus(CACHE).isAfter(LocalDateTime.now())) return u;
        u = fetch();
        cached = u;
        return u;
    }

    @SuppressWarnings("unchecked")
    private Updates fetch() {
        String current = systemStatusService.version();
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.ACCEPT, "application/vnd.github+json");
        headers.set(HttpHeaders.USER_AGENT, "MarForms-update-check");
        try {
            ResponseEntity<Map> response = restTemplate.exchange(api + "/repos/" + repo + "/releases/latest", HttpMethod.GET,
                    new HttpEntity<>(headers), Map.class);
            Map<String, Object> release = response.getBody();
            if (release == null) return new Updates(current, null, false, null, null, LocalDateTime.now(), null);
            String latest = strip((String) release.get("tag_name"));
            String body = (String) release.get("body");
            String notes = body == null ? null : body.strip().lines().filter(l -> !l.isBlank()).findFirst()
                    .map(l -> l.replaceFirst("^[#*\\-\\s]+", ""))
                    .map(l -> l.length() > NOTES_LIMIT ? l.substring(0, NOTES_LIMIT) + "…" : l).orElse(null);
            return new Updates(current, latest, isNewer(latest, current), notes, (String) release.get("html_url"),
                    LocalDateTime.now(), null);
        } catch (HttpClientErrorException.NotFound e) {
            // No release published yet.
            return new Updates(current, null, false, null, null, LocalDateTime.now(), null);
        } catch (Exception e) {
            log.warn("Update check failed: {}", e.getMessage());
            return new Updates(current, null, false, null, null, LocalDateTime.now(), "GitHub didn't answer");
        }
    }

    /** Forgets the last check (tests). */
    void forget() {
        cached = null;
    }

    private static String strip(String tag) {
        return tag == null ? null : tag.replaceFirst("^[vV]", "");
    }

    /** Compares dotted versions numerically; a pre-release suffix (-SNAPSHOT) is older than the plain version. */
    static boolean isNewer(String latest, String current) {
        if (latest == null || current == null || current.equals("dev")) return false;
        String[] a = latest.split("[-+]", 2)[0].split("\\.");
        String[] b = current.split("[-+]", 2)[0].split("\\.");
        for (int i = 0; i < Math.max(a.length, b.length); i++) {
            int x = i < a.length ? number(a[i]) : 0, y = i < b.length ? number(b[i]) : 0;
            if (x != y) return x > y;
        }
        return !latest.contains("-") && current.contains("-");
    }

    private static int number(String part) {
        try {
            return Integer.parseInt(part.replaceAll("\\D.*", ""));
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
