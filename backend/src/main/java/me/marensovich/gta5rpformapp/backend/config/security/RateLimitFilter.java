package me.marensovich.gta5rpformapp.backend.config.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Predicate;

/**
 * Per-client request limits for the endpoints anyone can call without an
 * account (security audit, #103): sign-in, the public form API, and above
 * all uploads and submissions, so one client can't fill the disk or flood a
 * server's moderation queue and Discord channels.
 * <p>
 * Fixed one-minute windows per client IP, kept in memory — enough for the
 * single-instance deployment (see ADR 0001). Behind a reverse proxy, set
 * {@code server.forward-headers-strategy=native} so the client's address,
 * not the proxy's, is used; and limit there too ({@code limit_req}).
 * </p>
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MILLIS = 60_000;

    record Rule(String name, int perMinute, Predicate<HttpServletRequest> applies) {
    }

    private final boolean enabled;
    private final List<Rule> rules;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public RateLimitFilter(@Value("${app.rate-limit.enabled:true}") boolean enabled,
                           @Value("${app.rate-limit.uploads-per-minute:30}") int uploads,
                           @Value("${app.rate-limit.submissions-per-minute:10}") int submissions,
                           @Value("${app.rate-limit.auth-per-minute:30}") int auth,
                           @Value("${app.rate-limit.public-per-minute:120}") int publicReads) {
        this.enabled = enabled;
        this.rules = List.of(
                new Rule("uploads", uploads, r -> isPost(r) && path(r).matches("/api/v1/public/forms/[^/]+/files")),
                new Rule("submissions", submissions,
                        r -> isPost(r) && path(r).matches("/api/v1/public/forms/[^/]+/submissions")),
                new Rule("auth", auth, r -> path(r).startsWith("/api/v1/auth/") || path(r).startsWith("/oauth2/")
                        || path(r).startsWith("/login/") || path(r).startsWith("/api/v1/guilds/connect/callback")),
                new Rule("public", publicReads, r -> path(r).startsWith("/api/v1/public/")));
    }

    private record Window(long start, AtomicInteger count) {
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !enabled;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Rule rule = rules.stream().filter(r -> r.applies().test(request)).findFirst().orElse(null);
        if (rule != null && !allow(rule, request.getRemoteAddr())) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", "60");
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"error\":\"Too many requests, try again in a minute\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    boolean allow(Rule rule, String client) {
        long now = System.currentTimeMillis();
        if (windows.size() > 50_000) windows.values().removeIf(w -> now - w.start() >= WINDOW_MILLIS);
        Window window = windows.compute(rule.name() + "|" + client, (key, current) ->
                current == null || now - current.start() >= WINDOW_MILLIS ? new Window(now, new AtomicInteger()) : current);
        return window.count().incrementAndGet() <= rule.perMinute();
    }

    private static String path(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String context = request.getContextPath();
        return context != null && !context.isEmpty() && uri.startsWith(context) ? uri.substring(context.length()) : uri;
    }

    private static boolean isPost(HttpServletRequest request) {
        return "POST".equalsIgnoreCase(request.getMethod());
    }
}
