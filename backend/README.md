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
| `TOKEN_ENCRYPTION_KEY` | AES-256 key (base64) for stored Discord user tokens |
| `FRONTEND_URL` | Used to build redirect URLs back to the SPA |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` | Discord OAuth2 app (user login) |
| `DISCORD_BOT_TOKEN` | Bot user token (JDA session) — blank disables bot features |
| `DISCORD_BOT_INSTALL_REDIRECT_URI` | Callback for the "Add to Discord" install flow |

## Tests

`./gradlew test` runs against an in-memory H2 database (see
`src/test/resources/application.properties`) — never the real Postgres
instance. Flyway is disabled for tests; Hibernate generates the schema
from the entities instead, since the migrations use Postgres-only syntax
(JSONB, etc).

## Background jobs

See [`docs/adr/0001-background-job-mechanism.md`](../docs/adr/0001-background-job-mechanism.md)
for the decision on how periodic/queued work (webhook delivery, guild-status
reconciliation) is handled — a DB-backed outbox table + `@Scheduled` pollers,
no Redis.
