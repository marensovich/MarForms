-- A published form's edits wait in a draft until «Опубликовать изменения» (ТЗ ФТ-5.6.2, #134),
-- and the form remembers who saved it last (ТЗ 5.7).
ALTER TABLE form ADD COLUMN draft_schema JSONB;
ALTER TABLE form ADD COLUMN updated_by BIGINT;
