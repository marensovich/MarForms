-- ============================================================
-- guild_memberships.staff_verified_at — when Discord last confirmed a role
-- ============================================================
-- OWNER and MODERATOR rows are re-checked through the bot on use (security
-- audit, #103): an owner must still own or manage the server, a moderator
-- must still be on it. NULL = not checked yet.

ALTER TABLE guild_memberships
    ADD COLUMN staff_verified_at TIMESTAMP WITHOUT TIME ZONE;
