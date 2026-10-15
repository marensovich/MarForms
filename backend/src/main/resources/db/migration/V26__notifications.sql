-- The bell of the panel (#122, ТЗ ФТ-4.1.2): what happened on a user's servers.
-- The text is rendered by the client from the type and params, in its language.
CREATE TABLE notifications
(
    id                   UUID PRIMARY KEY,
    recipient_discord_id BIGINT      NOT NULL,
    type                 VARCHAR(40) NOT NULL,
    guild_id             BIGINT,
    target_id            VARCHAR(64),
    params               JSONB,
    link                 VARCHAR(512),
    created_at           TIMESTAMP   NOT NULL,
    read_at              TIMESTAMP
);

CREATE INDEX idx_notifications_recipient ON notifications (recipient_discord_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications (recipient_discord_id) WHERE read_at IS NULL;
