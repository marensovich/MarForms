package me.marensovich.gta5rpformapp.backend.service.files;

import java.io.IOException;
import java.io.InputStream;

/**
 * Where uploaded files' bytes live (ADR 0003). Keys are random and opaque:
 * callers never pass user-supplied names. Local disk today; an
 * S3-compatible implementation replaces it when the app runs on more than
 * one instance.
 *
 * @author marensovich
 * @version v.0.1
 * @since v.0.1
 */
public interface FileStorage {

    /**
     * Stores bytes under a key, replacing nothing (keys are unique).
     *
     * @param key     the storage key
     * @param content the bytes
     * @throws IOException if the bytes can't be written
     */
    void store(String key, InputStream content) throws IOException;

    /**
     * Opens stored bytes for reading; the caller closes the stream.
     *
     * @param key the storage key
     * @return the bytes
     * @throws IOException if they can't be read (including: no such key)
     */
    InputStream open(String key) throws IOException;

    /**
     * Deletes stored bytes; a missing key is not an error.
     *
     * @param key the storage key
     * @throws IOException if they exist but can't be deleted
     */
    void delete(String key) throws IOException;
}
