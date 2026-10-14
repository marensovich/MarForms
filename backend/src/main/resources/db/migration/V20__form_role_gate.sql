-- ============================================================
-- RoleGate — Discord-role rules of a ROLE_GATED form (E2.1, #63)
-- ============================================================
-- Two independent lists (owner decision 2026-10-11, question 2 = B):
--   * form_allowed_roles — the respondent needs at least one of these roles
--     (an empty list means any member of the server);
--   * form_denied_roles  — any of these roles refuses access, and wins over
--     the allow list.
-- The rules only apply while form.access_mode = 'ROLE_GATED'; they are kept
-- when the mode changes, so switching back restores them.

CREATE TABLE form_allowed_roles
(
    form_id         UUID   NOT NULL,
    discord_role_id BIGINT NOT NULL,
    CONSTRAINT pk_form_allowed_roles PRIMARY KEY (form_id, discord_role_id),
    CONSTRAINT fk_form_allowed_roles_on_form FOREIGN KEY (form_id) REFERENCES form (id) ON DELETE CASCADE
);

CREATE TABLE form_denied_roles
(
    form_id         UUID   NOT NULL,
    discord_role_id BIGINT NOT NULL,
    CONSTRAINT pk_form_denied_roles PRIMARY KEY (form_id, discord_role_id),
    CONSTRAINT fk_form_denied_roles_on_form FOREIGN KEY (form_id) REFERENCES form (id) ON DELETE CASCADE
);
