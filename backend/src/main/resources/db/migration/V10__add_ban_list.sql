-- ============================================================
-- BanList — users barred from a guild's forms (E2.2, task #67)
-- ============================================================
-- Guild-scoped: a ban on one server says nothing about another. Keyed by
-- Discord ID rather than users.id so a user can be banned before they ever
-- log in to MarForms. The platform-wide ban (users.banned_*) is separate.

CREATE TABLE ban_list
(
    id         UUID                        NOT NULL,
    guild_id   BIGINT                      NOT NULL,
    discord_id BIGINT                      NOT NULL,
    banned_by  BIGINT,
    reason     VARCHAR(500),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT pk_ban_list PRIMARY KEY (id)
);

ALTER TABLE ban_list
    ADD CONSTRAINT uc_ban_list_guild_discord UNIQUE (guild_id, discord_id);

ALTER TABLE ban_list
    ADD CONSTRAINT fk_ban_list_on_guild FOREIGN KEY (guild_id) REFERENCES guilds (discord_guild_id);
