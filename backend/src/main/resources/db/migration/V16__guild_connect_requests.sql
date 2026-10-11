-- ============================================================
-- guild_connect_requests — one-time state for the bot-install flow
-- ============================================================
-- The "Add to Discord" link carries a random nonce as OAuth state; only its
-- SHA-256 is stored here, with who asked and until when. The callback
-- consumes the row, so a state can't be replayed or forged (security audit,
-- issue #103). Rows are short-lived and deleted on use or expiry.

CREATE TABLE guild_connect_requests
(
    nonce_hash VARCHAR(64)                 NOT NULL,
    discord_id BIGINT                      NOT NULL,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT pk_guild_connect_requests PRIMARY KEY (nonce_hash)
);

CREATE INDEX idx_guild_connect_requests_expires_at ON guild_connect_requests (expires_at);
