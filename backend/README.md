# MarForms backend

Spring Boot 3.5 / Java 25 backend for the MarForms Discord forms platform.

## Package structure

```
me.marensovich.gta5rpformapp.backend
├── config/         Spring configuration: security, JWT, OAuth2, JDA bot session
├── controller/      REST controllers, grouped under controller/v1/api for
│                    versioned API endpoints
├── data/            Enums and other plain value types, grouped by domain
│                    (guilds, forms, roles, audit, settings)
├── database/
│   ├── entity/      JPA entities
│   └── repository/  Spring Data repositories
├── dto/             Request/response DTOs, grouped by domain
├── exception/       Domain exceptions + GlobalExceptionHandler (unified
│                    error format for all 4xx/5xx responses)
└── service/         Business logic, including service/discord for the two
                     separate Discord integrations (see below)
```

There is no dedicated `guild`/`form`/`submission` top-level package per
domain — those are cross-cut across `service`, `database.entity`,
`database.repository` and `dto` instead, following the layer-first
structure already established before the multi-guild work started.

Two distinct Discord integrations live side by side, both under
`service/discord`:
- **`DiscordApiClient`** acts on behalf of a signed-in user with their own
  OAuth2 access token (e.g. syncing which guilds they belong to at login).
- **`DiscordBotClient`** acts as the bot itself via a persistent JDA/Gateway
  session (fetching real guild names, listing channels, creating webhooks,
  detecting when the bot is kicked). See `JdaConfig`.

### Discord tokens: bot vs user

| Call | Token | Why |
|---|---|---|
| `GET /users/@me/guilds` (which servers the user is in) | **user** | Only the user's own token can answer this |
| `POST /oauth2/token` (refresh) | client id/secret + user refresh token | Renews the user token |
| Guild name/icon, channel list, webhook creation | **bot** | Guild-side data; works regardless of who is logged in |
| Member roles (`GET /guilds/{g}/members/{u}`) | **bot** | Needed for role gating; see `GuildMembershipService` |
| Webhook execution | webhook URL token | No auth header at all |

User tokens are stored AES-GCM-encrypted in `discord_token_sets`
(`DiscordTokenService`, key from `TOKEN_ENCRYPTION_KEY`). The access token is
refreshed lazily on use when it's within a minute of expiry, and proactively
by `DiscordTokenRefresher` (every 30 min, anything expiring within an hour).
If Discord rejects the refresh token (revoked/de-authorized), the stored
tokens are dropped and the user just has to log in again.

## Error format

Every 4xx/5xx response goes through `GlobalExceptionHandler` and comes back
as a JSON object (shape varies slightly by exception type, but every
handler returns a `Map<String, String>`/error-message body with a matching
HTTP status — see the class for the exact mapping).

## Health check

`GET /api/health` → `200 {"status": "ok"}`. Deliberately outside `/api/v1`
and unauthenticated.

## Local setup

1. Start Postgres: `docker compose up -d` (from the repo root — see
   `../docker-compose.yml`). The backend itself runs on the host via Gradle,
   not inside Docker.
2. Copy `.env.example` to `.env` and fill in the real values (Discord
   application credentials, bot token, a generated JWT secret). `.env` is
   gitignored — never commit real secrets.
3. `./gradlew bootRun`

### Environment variables

| Variable | Purpose |
|---|---|
| `SPRING_APPLICATION_NAME` | Spring application name |
| `HOST_APP_PORT` | Port the backend listens on |
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DRIVER` | Postgres connection |
| `JWT_SECRET`, `JWT_EXPIRATION` | Our own session JWT signing key/lifetime |
| `TOKEN_ENCRYPTION_KEY` | AES-256 key (base64) for stored Discord user tokens and webhook URLs (`WebhookUrlCipher`; migration V15 encrypts existing ones). Changing it makes stored values unreadable |
| `DISCORD_MEMBER_ROLES_TTL` | ISO-8601 duration a member's cached Discord roles are trusted (default `PT5M`) |
| `FRONTEND_URL` | Used to build redirect URLs back to the SPA |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` | Discord OAuth2 app (user login) |
| `DISCORD_BOT_TOKEN` | Bot user token (JDA session) — blank disables bot features |
| `DISCORD_BOT_INSTALL_REDIRECT_URI` | Callback for the "Add to Discord" install flow |
| `FILES_DIR` | Where uploaded attachments are stored (default `./data/uploads`; a volume in Docker — back it up) |
| `SERVER_FORWARD_HEADERS_STRATEGY` | Set to `native` behind a reverse proxy, so rate limits see the client's IP, not the proxy's |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_WEBHOOK_SECRET` | Stripe billing; blank disables checkout (see Billing) |

Rate limits for anonymous endpoints (per client IP and minute) are properties too:
`app.rate-limit.uploads-per-minute` (30), `.submissions-per-minute` (10),
`.auth-per-minute` (30), `.public-per-minute` (120); `app.rate-limit.enabled=false`
turns them off. Outbound HTTP timeouts: `app.http.connect-timeout` (5s),
`app.http.read-timeout` (10s).

Plan limits are plain properties, not env variables: `app.plans.limits.<TIER>.active-forms`,
`.submissions-per-month`, `.moderators` (unset = unlimited; nothing is set by default).

## Deployment

`docker-compose.prod.yml` (repository root) runs Postgres, this backend and the
SPA behind nginx on one origin: nginx serves the app, proxies `/api`,
`/oauth2` and `/login` to the backend, caps request bodies and rate-limits
the public and sign-in endpoints. The frontend reads the API origin from
`VITE_API_URL` at build time (empty = same origin); the backend allows
browser calls from `CORS_ALLOWED_ORIGINS` (comma-separated, defaults to
`FRONTEND_URL`). `./gradlew bootRun` loads `backend/.env`. CI
(`.github/workflows/ci.yml`) runs the backend tests and the frontend build.

The app runs as a single instance: the job outbox, rate limits and the JDA
bot session are not shared between instances (ADR 0001).

## Tests

`./gradlew test` runs against an in-memory H2 database (see
`src/test/resources/application.properties`) — never the real Postgres
instance. Flyway is disabled for tests; Hibernate generates the schema
from the entities instead, since the migrations use Postgres-only syntax
(JSONB, etc).
PostgresIntegrationTest covers that gap with Testcontainers: it runs every
Flyway migration on a real Postgres, lets Hibernate validate the entities
against the result, and checks JSONB and row locking. It needs Docker and is
skipped without it; CI runs it. Tests that must see real transaction
boundaries (lazy loading, row locks) are not `@Transactional`.

## Forms

A form's fields live inside its JSONB `schema`, not in a separate table —
see [`docs/adr/0002-form-fields-in-jsonb.md`](../docs/adr/0002-form-fields-in-jsonb.md).
Lifecycle: `DRAFT` → `PUBLISHED` (gets a permanent public slug) →
`CLOSED` / `ARCHIVED`. Owners manage forms via
`/api/v1/guilds/{guildId}/forms` (platform admins with `FORMS_MANAGE` too);
`/api/v1/forms` only reads one form (`GET /{id}`) and checks a slug
(`GET /slug-available`). A form reviews responses on the site only with
`reviewEnabled`; otherwise a response just goes to Discord as `RECEIVED`.
`discordMessage` and each webhook's `content` go above the report.

Respondents use `/api/v1/public/forms/{slug}` (no session needed; never
returns webhooks). Access modes (`FormAccessService`):
- `OPEN` — anyone, no login required. If the respondent *is* logged in,
  their Discord ID is still recorded. This is **not** the Stage 2
  `ANONYMOUS` mode (E2.3), where identity is deliberately never stored.
- `AUTHENTICATED` — Discord login and membership of the form's server.
- `ANONYMOUS` — no login, and the author is never stored, even if logged in.
  A random per-browser `Anonymous-Token` header (only a per-form hash is
  stored) enforces the per-person limit.
- `ROLE_GATED` — reserved; blocked on open questions 2 and 4.

A guild's ban list (`/api/v1/guilds/{id}/bans`) refuses listed users on
every mode except `ANONYMOUS`.

Fields can be shown conditionally (`FormField.condition`, evaluated by
`FormConditions` and mirrored in `frontend/src/components/form/conditions.ts`):
a hidden field is never required and its answer is dropped.

File attachments (`FILE_UPLOAD`) are uploaded while the form is filled in
(`POST /api/v1/public/forms/{slug}/files`); the answer is the file id. See
[`docs/adr/0003-file-storage.md`](../docs/adr/0003-file-storage.md).

Submissions carry an `Idempotency-Key` header; a retried request with
the same key returns the original submission instead of a duplicate.

## Moderation

Owners and moderators list and decide on a guild's submissions
(`/api/v1/guilds/{id}/submissions`, `/api/v1/submissions/{id}/decision`);
respondents see their own at `/api/v1/me/submissions`. Moderator actions
(decisions, moderator changes, bans) are recorded in `audit_log` with the
guild id; the owner reads them at `/api/v1/guilds/{id}/audit-log`. Owners
export a form's submissions as streamed CSV at
`/api/v1/forms/{id}/export?format=csv`.

## Server settings

A server's owners set its admin roles (holders own the server in MarForms —
not the platform — while Discord shows the role), create its log category
with #аудит, and set the bot's nickname, avatar, banner and «Обо мне» there:
`/api/v1/guilds/{guildId}/settings`. The bot's status is one for every server:
`/api/v1/settings/bot-presence` (`SYSTEM_ADMIN`).

## Feedback

Signed-in users report bugs, ideas and potential problems at
`POST /api/v1/feedback` (each kind has its own questions, 5 an hour). It is
kept in `feedback` and posted to the webhook set at `/api/v1/settings/feedback`.

## Billing

See [`docs/adr/0004-billing-per-workspace.md`](../docs/adr/0004-billing-per-workspace.md).
Subscriptions belong to a workspace; every guild is in exactly one (an
implicit one of its own until its owner merges servers). Stripe webhooks
set `guilds.plan_tier`, which `PlanLimitService` reads. Owner actions over
a limit get a 402; respondents are never blocked.

To try it in Stripe test mode: create a recurring price, set the three
`STRIPE_*` variables, and forward webhooks locally with
`stripe listen --forward-to localhost:8090/api/v1/public/billing/stripe/webhook`
(events: `checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`). Enable
cancellation and plan changes in the Billing Portal settings.

## Background jobs

See [`docs/adr/0001-background-job-mechanism.md`](../docs/adr/0001-background-job-mechanism.md)
for the decision on how periodic/queued work (webhook delivery, Stripe
events, guild-status and webhook-health checks, cleanup of unused uploads)
is handled — a DB-backed outbox table + `@Scheduled` pollers, no Redis.
