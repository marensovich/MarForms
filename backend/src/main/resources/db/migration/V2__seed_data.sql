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
VALUES (gen_random_uuid(), 'VIEWER')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- ADMIN — full access
-- ============================================================

INSERT INTO role_permissions (role_id, permission)
SELECT id, perm
FROM roles,
     unnest(ARRAY [
         'DASHBOARD_ACCESS',
         'FORMS_VIEW',
         'FORMS_MANAGE',
         'RESPONSES_VIEW',
         'USERS_VIEW',
         'USERS_MANAGE',
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
         'FORMS_VIEW',
         'FORMS_MANAGE',
         'RESPONSES_VIEW',
         'USERS_VIEW'
         ]) AS perm
WHERE name = 'MODERATOR'
ON CONFLICT DO NOTHING;

-- ============================================================
-- VIEWER — read only
-- ============================================================

INSERT INTO role_permissions (role_id, permission)
SELECT id, perm
FROM roles,
     unnest(ARRAY [
         'DASHBOARD_ACCESS',
         'FORMS_VIEW',
         'RESPONSES_VIEW'
         ]) AS perm
WHERE name = 'VIEWER'
ON CONFLICT DO NOTHING;