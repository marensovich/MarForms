-- Platform roles (ТЗ 6.4, #145): the system role (the one with SYSTEM_ADMIN)
-- can't be deleted or lose SYSTEM_ADMIN, and the seeded roles get colours.
ALTER TABLE roles ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE roles SET is_system = TRUE
WHERE id IN (SELECT role_id FROM role_permissions WHERE permission = 'SYSTEM_ADMIN');

UPDATE roles SET color = '#DC2626' WHERE name = 'ADMIN' AND color IS NULL;
UPDATE roles SET color = '#2563EB' WHERE name = 'MODERATOR' AND color IS NULL;
UPDATE roles SET color = '#16A34A' WHERE name = 'USER' AND color IS NULL;
