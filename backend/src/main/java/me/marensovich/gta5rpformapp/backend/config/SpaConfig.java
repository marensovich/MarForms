package me.marensovich.gta5rpformapp.backend.config;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serves the SPA built into the image ({@code classpath:/static}, see the
 * root Dockerfile): files as they are, and {@code index.html} for any other
 * page path, so a deep link such as {@code /f/lspd} opens the app. API, OAuth
 * and unknown files keep their 404. Without a built SPA (development, tests)
 * nothing changes.
 */
@Configuration
public class SpaConfig implements WebMvcConfigurer {

    private static final String STATIC = "classpath:/static/";

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Vite puts a content hash in every file name under assets/.
        registry.addResourceHandler("/assets/**")
                .addResourceLocations(STATIC + "assets/")
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable());
        registry.addResourceHandler("/**")
                .addResourceLocations(STATIC)
                .setCacheControl(CacheControl.noCache())
                .resourceChain(true)
                .addResolver(new SpaResolver());
    }

    static final class SpaResolver extends PathResourceResolver {
        @Override
        protected Resource getResource(String path, Resource location) throws IOException {
            Resource file = location.createRelative(path);
            if (file.exists() && file.isReadable()) return file;
            if (!isPage(path)) return null;
            Resource index = location.createRelative("index.html");
            return index.exists() && index.isReadable() ? index : null;
        }

        /** A path the app's router shows; a missing file (with an extension) or a backend path is a 404. */
        static boolean isPage(String path) {
            if (path.startsWith("api/") || path.startsWith("oauth2/") || path.startsWith("login/")) return false;
            String last = path.substring(path.lastIndexOf('/') + 1);
            return !last.contains(".");
        }
    }
}
