-- ============================================================
-- form.version — optimistic locking (security audit, #103)
-- ============================================================
-- Two saves of the same form (two editors, or an editor and a background
-- webhook-status update) no longer silently overwrite each other: the later
-- one fails with 409 and is retried or reported.

ALTER TABLE form
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
