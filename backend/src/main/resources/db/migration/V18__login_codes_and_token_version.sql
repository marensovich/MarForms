-- ============================================================
-- Sign-in without a token in the URL, and revocable tokens (#103)
-- ============================================================
-- After Discord OAuth the browser gets a one-time code (60 s) instead of the
-- JWT; the code is exchanged for the JWT together with an HttpOnly cookie set
-- on the same redirect, so a code can't be used from another browser. Only
-- hashes are stored.

CREATE TABLE login_codes
(
    code_hash  VARCHAR(64)                 NOT NULL,
    nonce_hash VARCHAR(64)                 NOT NULL,
    discord_id BIGINT                      NOT NULL,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT pk_login_codes PRIMARY KEY (code_hash)
);

-- Tokens carry the version they were issued under; logging out bumps it,
-- which invalidates every token issued before.
ALTER TABLE users
    ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
