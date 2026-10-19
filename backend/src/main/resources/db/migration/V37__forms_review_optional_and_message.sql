-- Reviewing responses on the site is a form's option, off for new forms: a
-- response then only goes to Discord, as RECEIVED (2026-10-19). Forms that
-- exist keep the review they had.
ALTER TABLE form
    ADD COLUMN review_enabled BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE form SET review_enabled = TRUE;

-- The text above the report in Discord, for every channel of the form (role mentions etc.).
ALTER TABLE form
    ADD COLUMN discord_message TEXT;

-- One log channel per server: #ответы is gone, decisions go to #аудит.
ALTER TABLE guilds
    DROP COLUMN log_responses_channel_id,
    DROP COLUMN log_responses_webhook;
