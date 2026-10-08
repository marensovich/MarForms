-- ============================================================
-- Optimistic locking for moderation decisions (E1.3, task #53)
-- ============================================================
-- Two moderators deciding on the same submission at the same moment must
-- not silently overwrite each other: the second write fails with 409 and
-- the UI reloads the current state instead.

ALTER TABLE submission ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
