-- Short per-server submission number for people (#114): "Заявка #1048".
-- Existing submissions are numbered by creation time within each server.
ALTER TABLE submission ADD COLUMN number BIGINT;

UPDATE submission s
SET number = r.rn
FROM (SELECT s2.id, ROW_NUMBER() OVER (PARTITION BY f.server_id ORDER BY s2.created_at, s2.id) AS rn
      FROM submission s2
               JOIN form f ON f.id = s2.form_id) r
WHERE r.id = s.id;

CREATE INDEX idx_submission_form_number ON submission (form_id, number);
