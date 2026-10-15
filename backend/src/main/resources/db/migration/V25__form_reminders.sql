-- «Напомнить в Discord» on a form that hasn't opened yet (#121): the bot DMs the
-- link when it opens. One reminder per user and form; gone with the form.
CREATE TABLE form_reminders
(
    id         UUID PRIMARY KEY,
    form_id    UUID      NOT NULL REFERENCES form (id) ON DELETE CASCADE,
    discord_id BIGINT    NOT NULL,
    created_at TIMESTAMP NOT NULL,
    sent_at    TIMESTAMP,
    attempts   INT       NOT NULL DEFAULT 0,
    CONSTRAINT uq_form_reminders_form_user UNIQUE (form_id, discord_id)
);

CREATE INDEX idx_form_reminders_unsent ON form_reminders (form_id) WHERE sent_at IS NULL;
