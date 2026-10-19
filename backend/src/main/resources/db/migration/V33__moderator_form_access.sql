-- A moderator narrowed to some forms of the server (#18, #90; owner's answer
-- to question 3, 2026-10-11). Not restricted (the default, and every moderator
-- so far) = all the server's forms, as before. Restricted = only the listed
-- forms; a form deleted from the list doesn't widen the access to all of them.
ALTER TABLE guild_memberships ADD COLUMN forms_restricted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE moderator_form_access
(
    membership_id UUID NOT NULL REFERENCES guild_memberships (id) ON DELETE CASCADE,
    form_id       UUID NOT NULL REFERENCES form (id) ON DELETE CASCADE,
    PRIMARY KEY (membership_id, form_id)
);

CREATE INDEX idx_moderator_form_access_form ON moderator_form_access (form_id);
