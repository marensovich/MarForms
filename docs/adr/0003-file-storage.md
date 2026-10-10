# ADR 0003: File storage for form attachments

**Status:** Accepted
**Related tasks:** #83 (this decision), #84–#86 (file upload field, intake, UI), Epic #16

## Context

Stage 3 adds a `FILE_UPLOAD` field: respondents attach a file, moderators
open it from the moderation card. The spec doesn't fix where files live.
Two realistic options:

1. **Local disk / Docker volume.** Nothing new to run; files sit next to
   the app. Fine for one instance. Breaks down with several app instances
   (each has its own disk) and makes backups a separate concern from the
   database.
2. **S3-compatible object storage** (AWS S3, Cloudflare R2, MinIO, …).
   Scales across instances, cheap, has lifecycle rules and presigned
   URLs. Adds a service and credentials to every environment, including
   local development and CI.

Today the product runs as a single instance next to one Postgres
(`docker-compose.yml`), the same reasoning that kept the job queue in
Postgres (ADR 0001).

## Decision

**Store files behind a small `FileStorage` interface, with a local-disk
implementation as the default; add an S3-compatible implementation when the
app first runs as more than one instance.**

- `FileStorage` has three operations: `store(key, stream)`, `open(key)`,
  `delete(key)`. Nothing else in the code knows where bytes live.
- `LocalFileStorage` writes under `app.files.dir` (default `./data/uploads`,
  a volume in Docker). Keys are random UUIDs, never user-supplied names, so
  path traversal and name collisions are impossible.
- Metadata (original name, type, size, form, field, owning submission)
  lives in Postgres (`submission_file`), so the database stays the source
  of truth and the storage holds only opaque blobs.

### Upload flow

Files are uploaded **separately from the submission**, while the
respondent is still filling the form in
(`POST /api/v1/public/forms/{slug}/files`, multipart). The answer for a
`FILE_UPLOAD` field is the returned file ID. This is a deliberate
deviation from "multipart as part of the submission" (task #85): a large
upload never holds up the rest of the form (spec раздел 8), a failed upload
is retried on its own, and submission intake stays a small, idempotent
JSON request.

- An upload is checked against the field's allowed extensions and size
  limit (and the platform cap, `app.files.max-size-mb`), and against the
  same access rules as submitting (`FormAccessService`).
- Submitting attaches the file to the submission. A file must belong to the
  same form and field and not be attached already.
- Files never attached (abandoned forms, answers hidden by branching) are
  deleted by a scheduled cleanup after 24 hours.

### Serving files

Only the guild's owner and moderators (or platform `RESPONSES_MANAGE`) can
download, through the backend (`GET /api/v1/files/{id}`), always as an
attachment with `X-Content-Type-Options: nosniff`, so an uploaded HTML or
SVG file is never rendered in the app's origin.

## Consequences

- No new infrastructure now. Running several instances, or moving to a
  host without a persistent volume, requires the S3 implementation first.
  That is one class plus configuration, not a migration of callers.
- Backups must include the uploads volume as well as the database.
- Files go through the backend on download. Presigned URLs only come with
  the S3 implementation, which is acceptable at current volumes.
- No antivirus scanning yet: files are only ever served as downloads, never
  executed or rendered by the app. Revisit if attachments are ever shown
  inline or shared beyond moderators.
