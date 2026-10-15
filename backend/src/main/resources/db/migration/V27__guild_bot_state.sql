-- «Мои серверы» (#124, ТЗ 4.2): member count and the bot's missing permissions,
-- as last seen through the bot.
ALTER TABLE guilds ADD COLUMN member_count INT;
ALTER TABLE guilds ADD COLUMN missing_permissions VARCHAR(255);
ALTER TABLE guilds ADD COLUMN synced_at TIMESTAMP;
