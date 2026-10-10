-- ============================================================
-- Anonymous form mode (E2.3, task #70)
-- ============================================================
-- An ANONYMOUS form never records who submitted (discord_id stays NULL).
-- The browser sends a random per-browser token; only SHA-256(form id + token)
-- is stored, so the same browser's submissions to one form can be counted
-- for the per-user limit, but can't be linked across forms or to a person.

ALTER TABLE submission ADD COLUMN anonymous_token VARCHAR(64);

CREATE INDEX idx_submission_form_anonymous_token ON submission (form_id, anonymous_token);
