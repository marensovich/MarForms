-- Feedback about MarForms itself (2026-10-19): bugs, ideas, potential problems.
-- Not a form of the forms system; it goes to the platform's feedback webhook,
-- and is kept here so nothing is lost while no webhook is set.
CREATE TABLE feedback
(
    id               UUID PRIMARY KEY,
    type             VARCHAR(20)  NOT NULL,
    author_discord_id BIGINT      NOT NULL,
    author_username  VARCHAR(255),
    answers          JSONB        NOT NULL,
    page             VARCHAR(300),
    delivered        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMP    NOT NULL
);

CREATE INDEX idx_feedback_author_created ON feedback (author_discord_id, created_at);
