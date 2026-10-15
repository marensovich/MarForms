-- Form title as a plain column (#107): searchable and sortable without reading
-- the JSONB schema. Kept in step with schema.title by Form#syncDerivedFields.
ALTER TABLE form ADD COLUMN title VARCHAR(255);
UPDATE form SET title = LEFT(COALESCE(schema ->> 'title', ''), 255);
ALTER TABLE form ALTER COLUMN title SET NOT NULL;
CREATE INDEX idx_form_title_lower ON form (LOWER(title));
