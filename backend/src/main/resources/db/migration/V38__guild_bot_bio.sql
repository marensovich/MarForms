-- The bot's «Обо мне» on a server (2026-10-19): Discord takes it but doesn't
-- give it back, so the panel keeps the last one set.
ALTER TABLE guilds
    ADD COLUMN bot_bio VARCHAR(190);
