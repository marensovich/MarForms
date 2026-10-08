-- ============================================================
-- DiscordTokenSet — a user's own Discord OAuth2 tokens (task #31)
-- ============================================================
-- Kept so the backend can call the Discord API on the user's behalf after
-- login (e.g. re-syncing which guilds they belong to) and refresh the
-- short-lived access token via the refresh token, without a re-login.
-- Both tokens are stored AES-GCM-encrypted (see TokenCipher) — never in
-- plaintext. One row per user.

CREATE TABLE discord_token_sets
(
    user_id                 BIGINT                      NOT NULL,
    access_token_encrypted  TEXT                        NOT NULL,
    refresh_token_encrypted TEXT,
    expires_at              TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    scopes                  VARCHAR(255),
    updated_at              TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT pk_discord_token_sets PRIMARY KEY (user_id)
);

ALTER TABLE discord_token_sets
    ADD CONSTRAINT fk_discord_token_sets_on_user FOREIGN KEY (user_id) REFERENCES users (id);

CREATE INDEX idx_discord_token_sets_expires_at ON discord_token_sets (expires_at);
