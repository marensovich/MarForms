package me.marensovich.gta5rpformapp.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.net.ServerSocket;
import java.net.Socket;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A server that accepts a connection and never answers must not hang the
 * caller (security audit, #103).
 */
class HttpClientConfigTest {

    @Test
    void aSilentServerTimesOut() throws Exception {
        RestTemplate client = new HttpClientConfig()
                .restTemplate(new RestTemplateBuilder(), Duration.ofSeconds(1), Duration.ofMillis(300));
        try (ServerSocket server = new ServerSocket(0)) {
            Thread acceptor = Thread.ofVirtual().start(() -> {
                try (Socket ignored = server.accept()) {
                    Thread.sleep(10_000);
                } catch (Exception ignored) {
                    // closed by the test
                }
            });
            long started = System.nanoTime();
            assertThatThrownBy(() -> client.getForObject("http://127.0.0.1:" + server.getLocalPort() + "/", String.class))
                    .isInstanceOf(ResourceAccessException.class);
            assertThat(Duration.ofNanos(System.nanoTime() - started)).isLessThan(Duration.ofSeconds(5));
            acceptor.interrupt();
        }
    }
}
