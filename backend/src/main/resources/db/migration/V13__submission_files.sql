-- ============================================================
-- File attachments (E3.2, tasks #84-#85, ADR 0003)
-- ============================================================
-- Metadata of uploaded files; the bytes live in FileStorage under
-- storage_key. A file is uploaded while the form is being filled in
-- (submission_id NULL) and attached when the submission is made.
-- Unattached files, and files whose submission is gone, are removed by a
-- scheduled cleanup (deliberately no FKs: submissions themselves have no FK
-- to form either, and the cleanup must also see the blobs to delete).

CREATE TABLE submission_file
(
    id            UUID                        NOT NULL,
    form_id       UUID                        NOT NULL,
    field_id      VARCHAR(100)                NOT NULL,
    submission_id UUID,
    original_name VARCHAR(255)                NOT NULL,
    content_type  VARCHAR(100),
    size_bytes    BIGINT                      NOT NULL,
    storage_key   VARCHAR(100)                NOT NULL,
    uploaded_by   BIGINT,
    created_at    TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT pk_submission_file PRIMARY KEY (id)
);

CREATE INDEX idx_submission_file_submission ON submission_file (submission_id);
CREATE INDEX idx_submission_file_unattached ON submission_file (created_at) WHERE submission_id IS NULL;
