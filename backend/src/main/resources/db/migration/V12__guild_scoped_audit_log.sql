-- ============================================================
-- Guild-scoped audit log (E2.5, task #76)
-- ============================================================
-- The existing audit_log (platform admin journal) is extended rather than
-- duplicated: moderator actions on a server (decisions, moderator changes,
-- bans) carry guild_id so the server's owner can review them, plus a
-- structured target and metadata. Platform-level entries keep guild_id NULL.

ALTER TABLE audit_log ADD COLUMN guild_id BIGINT;
ALTER TABLE audit_log ADD COLUMN target_type VARCHAR(30);
ALTER TABLE audit_log ADD COLUMN metadata JSONB;

CREATE INDEX idx_audit_log_guild_created ON audit_log (guild_id, created_at);
