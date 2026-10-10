package me.marensovich.gta5rpformapp.backend.service.files;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.regex.Pattern;

/**
 * {@link FileStorage} on the local disk (a Docker volume in production),
 * under {@code app.files.dir}. Files are spread over two-character
 * subdirectories so no single directory grows huge.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
@Component
public class LocalFileStorage implements FileStorage {

    private static final Pattern SAFE_KEY = Pattern.compile("^[a-f0-9-]{8,64}$");

    private final Path root;

    public LocalFileStorage(@Value("${app.files.dir:./data/uploads}") String dir) {
        this.root = Path.of(dir).toAbsolutePath().normalize();
    }

    @Override
    public void store(String key, InputStream content) throws IOException {
        Path target = resolve(key);
        Files.createDirectories(target.getParent());
        Files.copy(content, target, StandardCopyOption.REPLACE_EXISTING);
    }

    @Override
    public InputStream open(String key) throws IOException {
        return Files.newInputStream(resolve(key));
    }

    @Override
    public void delete(String key) throws IOException {
        Files.deleteIfExists(resolve(key));
    }

    private Path resolve(String key) {
        // Keys are generated UUIDs; refuse anything else so a bad key can never escape the root.
        if (key == null || !SAFE_KEY.matcher(key).matches()) {
            throw new IllegalArgumentException("Invalid storage key");
        }
        return root.resolve(key.substring(0, 2)).resolve(key);
    }
}
