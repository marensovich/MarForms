-- ============================================================
-- Guild / GuildMembership — foundation for multi-guild support
-- ============================================================
-- A Guild row exists once the bot has been added to a Discord server
-- (see raздел 4.1 of the product spec). GuildMembership records both
-- passive membership (role = RESPONDENT, used for form access checks)
-- and elevated per-guild roles (OWNER / MODERATOR) — this replaces the
-- old flat `user_guilds` set going forward for anything guild-specific,
-- while the existing global `roles`/`user_roles` tables are kept as the
-- separate platform-admin layer (SaaS operator access), not per-guild
-- moderation.

CREATE TABLE guilds
(
    discord_guild_id BIGINT                      NOT NULL,
    name             VARCHAR(255)                NOT NULL,
    icon_hash        VARCHAR(255),
    bot_status       VARCHAR(20)                 NOT NULL,
    plan_tier        VARCHAR(20)                 NOT NULL DEFAULT 'FREE',
    connected_at     TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT pk_guilds PRIMARY KEY (discord_guild_id)
);

CREATE TABLE guild_memberships
(
    id                       UUID                        NOT NULL,
    user_id                  BIGINT                      NOT NULL,
    guild_id                 BIGINT                      NOT NULL,
    role                     VARCHAR(20)                 NOT NULL,
    discord_roles            JSONB,
    discord_roles_synced_at  TIMESTAMP WITHOUT TIME ZONE,
    created_at               TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT pk_guild_memberships PRIMARY KEY (id)
);

ALTER TABLE guild_memberships
    ADD CONSTRAINT uc_guild_memberships_user_guild UNIQUE (user_id, guild_id);

ALTER TABLE guild_memberships
    ADD CONSTRAINT fk_guild_memberships_on_user FOREIGN KEY (user_id) REFERENCES users (id);

ALTER TABLE guild_memberships
    ADD CONSTRAINT fk_guild_memberships_on_guild FOREIGN KEY (guild_id) REFERENCES guilds (discord_guild_id);

CREATE INDEX idx_guild_memberships_guild ON guild_memberships (guild_id);
