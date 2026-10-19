-- Back-to-back edits of one form by one person are one journal entry, from
-- created_at to last_at (2026-10-19).
ALTER TABLE audit_log
    ADD COLUMN last_at TIMESTAMP;
