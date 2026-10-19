-- A server's admin roles: their holders are owners of that server in MarForms
-- (not of the platform), and see its log channels (2026-10-19).
CREATE TABLE guild_admin_roles
(
    guild_id BIGINT NOT NULL REFERENCES guilds (discord_guild_id) ON DELETE CASCADE,
    role_id  BIGINT NOT NULL,
    PRIMARY KEY (guild_id, role_id)
);

-- The log channels the bot created: a category with #ответы and #аудит, each
-- with a webhook (its URL sealed like a form's).
ALTER TABLE guilds
    ADD COLUMN log_category_id          BIGINT,
    ADD COLUMN log_responses_channel_id BIGINT,
    ADD COLUMN log_responses_webhook    TEXT,
    ADD COLUMN log_audit_channel_id     BIGINT,
    ADD COLUMN log_audit_webhook        TEXT;

-- An owner who is one through an admin role, not as the installer or a Manage Server holder.
ALTER TABLE guild_memberships
    ADD COLUMN owner_by_admin_role BOOLEAN NOT NULL DEFAULT FALSE;
