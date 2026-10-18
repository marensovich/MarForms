-- Platform restrictions (ТЗ 6.3, #144): a ban (users.banned_permanently)
-- blocks the whole platform, a time-out (users.banned_until) only sending
-- submissions and the panel. Both carry a reason the user sees, and every
-- one is kept in user_restrictions: who, when, why, and who lifted it.
ALTER TABLE users ADD COLUMN restriction_reason TEXT;
ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE users ADD COLUMN created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now();

-- A role's chip colour (#RRGGBB).
ALTER TABLE roles ADD COLUMN color VARCHAR(7);

CREATE TABLE user_restrictions
(
    id              UUID PRIMARY KEY,
    user_discord_id BIGINT                      NOT NULL,
    type            VARCHAR(10)                 NOT NULL,
    reason          TEXT,
    ends_at         TIMESTAMP WITHOUT TIME ZONE,
    created_by      BIGINT,
    created_by_name VARCHAR(100),
    created_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    lifted_by       BIGINT,
    lifted_by_name  VARCHAR(100),
    lifted_at       TIMESTAMP WITHOUT TIME ZONE
);
CREATE INDEX idx_user_restrictions_user ON user_restrictions (user_discord_id, created_at DESC);
