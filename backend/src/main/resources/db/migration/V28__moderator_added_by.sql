-- Moderators (ТЗ 4.7.1, #130): who made a member a moderator, and when.
ALTER TABLE guild_memberships ADD COLUMN moderator_added_by BIGINT;
ALTER TABLE guild_memberships ADD COLUMN moderator_added_at TIMESTAMP;
