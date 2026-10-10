-- ============================================================
-- Discord avatar hash on users (E1.3, task #55)
-- ============================================================
-- The moderation card shows the author's avatar. Discord only gives us the
-- hash (cdn.discordapp.com/avatars/{id}/{hash}.png), refreshed on each login.

ALTER TABLE users ADD COLUMN discord_avatar VARCHAR(64);
