# ADR 0002: Form fields stay in the form's JSONB schema

- **Status:** Accepted
- **Date:** 2026-10-08
- **Context task:** #39 (Миграция БД: таблицы Form, FormField)

## Context

Task #39 describes a separate `form_fields` table (`id, form_id FK, type,
required, position, config jsonb`). The application already stores a form's
fields inside `form.schema` (JSONB): `{title, description, fields: [...]}`,
with 15 field types and a working builder, renderer and webhook formatter
all reading that structure. Submissions reference fields by their `id`
inside `answers`.

## Decision

Keep fields inside `form.schema`. Add the rest of #39's columns to `form`
(`status`, `access_mode`, `slug`, `submission_limit_per_user`, `opens_at`,
`closes_at`, `updated_at`, migration V6) and the two missing Stage 1 field
types (`RATING`, `SECTION_BREAK`).

The per-field API from #42 (`POST/PUT/DELETE /api/v1/forms/{formId}/fields`,
`PUT .../fields/reorder`) works on that JSON array.

## Why

- **Atomicity for free.** Re-ordering, which #42 requires to be atomic, is a
  single row write. With a table it is N updates plus position-uniqueness
  juggling.
- **The form is read as a whole.** The renderer, validator and webhook
  formatter always need every field, in order. A table adds a join and
  sorting to every read and gives nothing back.
- **No regression.** Migrating to a table would mean rewriting the builder,
  the renderer and every existing form's data, with no user-visible gain.
- **Validation stays in one place.** `FormSchemaValidator` checks the whole
  schema on every write path (whole-form PUT and per-field API).

## Consequences

- Querying "every form that uses field type X" needs a JSONB query rather
  than a join. No feature needs that.
- Conditional logic (branching, Stage 3 / E3.1) is **not** part of this
  schema. It will be added as a `condition` property on fields, with its
  own migration and validation (no cycles).
- Spec type names map onto existing types: `short_text` → `TEXT`,
  `long_text` → `TEXTAREA`, `single_choice` → `RADIO`/`SELECT`,
  `multiple_choice` → `MULTI_SELECT`/`CHECKBOX`, `number`, `date`,
  `rating`, `section_break`. `file_upload` (Stage 3) is not added yet.
