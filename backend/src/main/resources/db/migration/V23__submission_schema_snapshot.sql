-- A submission keeps the questions it answered (#117): renaming or removing a
-- field later doesn't change how earlier submissions read. Existing submissions
-- get the form's schema as it is now — the best record there is.
ALTER TABLE submission ADD COLUMN schema_snapshot JSONB;

UPDATE submission s
SET schema_snapshot = f.schema
FROM form f
WHERE f.id = s.form_id;
