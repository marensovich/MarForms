package me.marensovich.gta5rpformapp.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * The one HTTP client for calls to Discord, Stripe and webhooks (security
 * audit, #103). Every call has a connect and a read timeout: the scheduled
 * jobs share a small thread pool, and a server that accepts a connection and
 * never answers must not stall webhook delivery, billing and the rest.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Configuration
public class HttpClientConfig {

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder,
                                     @Value("${app.http.connect-timeout:5s}") Duration connectTimeout,
                                     @Value("${app.http.read-timeout:10s}") Duration readTimeout) {
        return builder.connectTimeout(connectTimeout).readTimeout(readTimeout).build();
    }
}
