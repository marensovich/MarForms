-- ============================================================
-- Submission: moderation status, idempotency (E1.2, task #47)
-- ============================================================
-- Respondents and moderators are identified by their Discord snowflake
-- (discord_id / moderator_discord_id), like everywhere else in the schema,
-- rather than by the internal users.id.
--
-- discord_id becomes nullable: an OPEN form may be filled in without
-- logging in. (The Stage 2 anonymous mode, E2.3, will also rely on it;
-- its logic is not part of this migration.)

ALTER TABLE submission ALTER COLUMN discord_id DROP NOT NULL;

ALTER TABLE submission ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
ALTER TABLE submission ADD COLUMN moderator_discord_id BIGINT;
ALTER TABLE submission ADD COLUMN moderator_comment TEXT;
ALTER TABLE submission ADD COLUMN decided_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE submission ADD COLUMN idempotency_key VARCHAR(100);

-- Product spec раздел 8: a retried submit with the same key must not
-- create a second row.
ALTER TABLE submission ADD CONSTRAINT uc_submission_idempotency_key UNIQUE (idempotency_key);

CREATE INDEX idx_submission_form_status ON submission (form_id, status);
CREATE INDEX idx_submission_form_discord ON submission (form_id, discord_id);
