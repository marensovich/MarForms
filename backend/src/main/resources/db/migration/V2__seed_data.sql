-- ============================================================
-- Default roles
-- ============================================================

INSERT INTO roles (id, name)
VALUES (gen_random_uuid(), 'ADMIN')
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (id, name)
VALUES (gen_random_uuid(), 'MODERATOR')
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (id, name)
VALUES (gen_random_uuid(), 'USER')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- ADMIN — full access
-- ============================================================

INSERT INTO role_permissions (role_id, permission)
SELECT id, perm
FROM roles,
     unnest(ARRAY [
         'DASHBOARD_ACCESS',
         'FORMS_MANAGE',
         'RESPONSES_MANAGE',
         'USERS_MODERATE',
         'ROLES_MANAGE',
         'SYSTEM_ADMIN'
         ]) AS perm
WHERE name = 'ADMIN'
ON CONFLICT DO NOTHING;

-- ============================================================
-- MODERATOR — forms + read users
-- ============================================================

INSERT INTO role_permissions (role_id, permission)
SELECT id, perm
FROM roles,
     unnest(ARRAY [
         'DASHBOARD_ACCESS',
         'FORMS_MANAGE',
         'RESPONSES_MANAGE',
         'USERS_MODERATE'
         ]) AS perm
WHERE name = 'MODERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO settings (key, value)
VALUES ('ban.message', 'You are banned. Please contact the administrator.'),
       ('ban.admin.contact', 'Administrator'),
       ('system.name', 'MarForms'),
       ('system.contact', '')
ON CONFLICT (key) DO NOTHING;