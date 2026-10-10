-- ============================================================
-- Workspaces and subscriptions (E4.2 #96, prepares E4.3 #99)
-- ============================================================
-- Billing is attached to a workspace, never directly to a guild: every guild
-- gets an implicit single-guild workspace from day one. Merging several
-- guilds under one owner's subscription (E4.3) then only moves rows in
-- workspace_guilds, without touching subscriptions. See docs/adr/0004.

CREATE TABLE workspaces
(
    id            UUID                        NOT NULL,
    owner_user_id BIGINT,
    name          VARCHAR(100)                NOT NULL,
    created_at    TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT pk_workspaces PRIMARY KEY (id)
);

ALTER TABLE workspaces
    ADD CONSTRAINT fk_workspaces_on_owner FOREIGN KEY (owner_user_id) REFERENCES users (id);

-- A guild belongs to exactly one workspace.
CREATE TABLE workspace_guilds
(
    guild_id     BIGINT NOT NULL,
    workspace_id UUID   NOT NULL,
    CONSTRAINT pk_workspace_guilds PRIMARY KEY (guild_id)
);

ALTER TABLE workspace_guilds
    ADD CONSTRAINT fk_workspace_guilds_on_guild FOREIGN KEY (guild_id) REFERENCES guilds (discord_guild_id);
ALTER TABLE workspace_guilds
    ADD CONSTRAINT fk_workspace_guilds_on_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id);
CREATE INDEX idx_workspace_guilds_workspace ON workspace_guilds (workspace_id);

-- Implicit workspace for every existing guild. The id is derived from the
-- guild id so both inserts agree without a temporary mapping table.
INSERT INTO workspaces (id, owner_user_id, name, created_at)
SELECT md5('workspace-' || g.discord_guild_id)::uuid,
       (SELECT gm.user_id FROM guild_memberships gm
        WHERE gm.guild_id = g.discord_guild_id AND gm.role = 'OWNER'
        ORDER BY gm.created_at LIMIT 1),
       LEFT(g.name, 100),
       NOW()
FROM guilds g;

INSERT INTO workspace_guilds (guild_id, workspace_id)
SELECT g.discord_guild_id, md5('workspace-' || g.discord_guild_id)::uuid
FROM guilds g;

-- One subscription per workspace, mirrored from Stripe by webhooks.
CREATE TABLE subscriptions
(
    id                     UUID                        NOT NULL,
    workspace_id           UUID                        NOT NULL,
    plan_tier              VARCHAR(20)                 NOT NULL,
    stripe_customer_id     VARCHAR(100),
    stripe_subscription_id VARCHAR(100),
    status                 VARCHAR(30)                 NOT NULL,
    current_period_end     TIMESTAMP WITHOUT TIME ZONE,
    cancel_at_period_end   BOOLEAN                     NOT NULL DEFAULT FALSE,
    last_event_at          TIMESTAMP WITHOUT TIME ZONE,
    updated_at             TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT pk_subscriptions PRIMARY KEY (id),
    CONSTRAINT uc_subscriptions_workspace UNIQUE (workspace_id),
    CONSTRAINT uc_subscriptions_stripe_subscription UNIQUE (stripe_subscription_id)
);

ALTER TABLE subscriptions
    ADD CONSTRAINT fk_subscriptions_on_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id);

-- Stripe event ids already accepted: Stripe retries deliveries, and each
-- event must be applied once.
CREATE TABLE stripe_events
(
    event_id    VARCHAR(100)                NOT NULL,
    type        VARCHAR(100)                NOT NULL,
    received_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT pk_stripe_events PRIMARY KEY (event_id)
);
