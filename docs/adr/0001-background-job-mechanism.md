# ADR 0001: Background job mechanism for webhook delivery and other async work

**Status:** Accepted
**Related tasks:** #24 (this decision), #57–#59 (webhook delivery queue, Epic #8), #37/#4 (bot-kick reconciliation, already implemented following this pattern)

## Context

The product spec (раздел 9) recommends Redis + BullMQ for background jobs
(webhook delivery, retries, future scheduled work). That recommendation is
Node-specific — this backend is Spring Boot / Java, where BullMQ doesn't
apply, and we need our own equivalent decision.

Two realistic options for a Spring Boot stack:

1. **DB-backed outbox table + `@Scheduled` poller.** No new infrastructure —
   reuses the Postgres instance already required for everything else. A row
   is enqueued in the same transaction as the business write it depends on
   (e.g. a submission being created), so enqueue and commit are atomic. A
   scheduled poller picks up due rows, attempts delivery, and updates
   status/attempt count.
2. **Redis + a Java queue client (e.g. Redisson).** Lower latency, built-in
   primitives for delayed retries and rate limiting, but adds a service to
   operate, back up, and monitor, and introduces a second place (Redis +
   Postgres) where job state can drift out of sync with the business data
   that triggered the job.

## Decision

**Option (a): a DB-backed outbox table, polled by `@Scheduled` jobs.**

Rationale:
- No new infrastructure. `docker-compose.yml` currently runs only Postgres;
  this keeps it that way. Every environment that already runs the app (dev,
  CI, prod) gets the queue for free.
- The volume this product actually needs it for — webhook notifications per
  form submission, guild-status reconciliation, eventually billing-related
  jobs — is low enough that Redis's throughput advantages don't matter. If
  that changes materially (Stage 3+, high-volume guilds), this ADR should be
  revisited.
- We've already established the `@Scheduled` pattern in this codebase for
  comparable periodic work (`GuildStatusReconciler`, see Epic #4) — an outbox
  poller is the same shape of job, just triggered by new rows instead of a
  fixed guild list.
- Enqueue-with-the-triggering-write, in one Postgres transaction, is simpler
  to reason about than a dual-write to Postgres + Redis, and rules out a
  whole class of bugs where the job never gets enqueued because the app
  crashed between the DB commit and the Redis push (or vice versa).

Trade-off accepted: polling has a floor on latency (bounded by the poll
interval, not push-based), and at very high volume a table-scan-per-poll
approach needs care (indexed `status`/`next_attempt_at` columns, batched
claims). Neither is a concern at this product's current scale.

## Consequences

- A skeleton `outbound_jobs` table is added in this same change
  (`V4__add_outbound_jobs.sql`) — no JPA entity/service yet, that's the scope
  of the webhook-delivery-queue task (#58) which consumes this table.
- #58 (webhook delivery queue) and #59 (retry/rate-limit handling) build on
  this table rather than introducing Redis.
- Any future background-job need (Stage 2 audit-log processing, Stage 4
  billing webhooks) should default to the same outbox pattern unless a
  specific requirement (e.g. sub-second delivery latency) justifies
  revisiting this decision.
- **Single instance only (recorded 2026-10-11, security audit #103).** The
  pollers read due jobs without claiming them (no `FOR UPDATE SKIP LOCKED`
  or IN_PROGRESS state), the rate limiter keeps its counters in memory, and
  the JDA bot holds one Gateway session — so a second backend instance would
  deliver webhooks twice and split the limits. Running more than one needs
  job claiming (`SELECT ... FOR UPDATE SKIP LOCKED` plus a lease), a shared
  rate-limit store, and the bot in a single worker.
- Finished jobs are deleted after `app.jobs.retention-days` (14): payloads
  copy submission answers.
