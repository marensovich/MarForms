-- The bot no longer asks for Manage Roles (2026-10-19): it never changes roles,
-- reading members and their roles needs no permission. A server whose stored
-- state lacked only it is no longer "missing permissions".
UPDATE guilds
SET missing_permissions = NULLIF(
        TRIM(BOTH ',' FROM REPLACE(REPLACE(',' || missing_permissions || ',', ',MANAGE_ROLES,', ','), ',,', ',')),
        '')
WHERE missing_permissions LIKE '%MANAGE_ROLES%';
