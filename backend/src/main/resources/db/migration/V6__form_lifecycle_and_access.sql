-- ============================================================
-- Form lifecycle, access mode, public slug (E1.1, task #39)
-- ============================================================
-- Fields stay inside form.schema (JSONB) rather than a separate
-- form_fields table — see docs/adr/0002-form-fields-in-jsonb.md.
-- Conditional logic (branching) is NOT part of this schema; it gets its
-- own migration in Stage 3 (E3.1).
--
-- `active` is kept for backward compatibility and is always kept equal to
-- (status = 'PUBLISHED') by the application.

ALTER TABLE form ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'DRAFT';
ALTER TABLE form ADD COLUMN access_mode VARCHAR(20) NOT NULL DEFAULT 'AUTHENTICATED';
ALTER TABLE form ADD COLUMN slug VARCHAR(80);
ALTER TABLE form ADD COLUMN submission_limit_per_user INTEGER;
ALTER TABLE form ADD COLUMN opens_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE form ADD COLUMN closes_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE form ADD COLUMN updated_at TIMESTAMP WITHOUT TIME ZONE;

-- Existing forms were usable as soon as they were active: map them onto
-- the new lifecycle and give them a slug so they stay reachable.
UPDATE form SET status = CASE WHEN active THEN 'PUBLISHED' ELSE 'CLOSED' END;
UPDATE form SET slug = 'f-' || substr(replace(id::text, '-', ''), 1, 12);
UPDATE form SET updated_at = created_at;

ALTER TABLE form ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE form ADD CONSTRAINT uc_form_slug UNIQUE (slug);

CREATE INDEX idx_form_server_id ON form (server_id);
