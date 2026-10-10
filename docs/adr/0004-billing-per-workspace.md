# ADR 0004: Billing per workspace, with an implicit workspace per guild

**Status:** Accepted
**Related tasks:** #96, #97 (Stripe, Epic #20), #99–#101 (workspaces, Epic #21)

## Context

Stage 4 adds paid plans through Stripe. Spec раздел 7, принцип 4 also
asks that one owner can pay once for several servers (Epic E4.3). If a
subscription pointed straight at a guild, E4.3 would have to migrate every
live subscription to a new owner entity without interrupting payment —
the risky step #100 describes.

## Decision

**A subscription belongs to a workspace, and every guild belongs to exactly
one workspace from the start.**

- `workspaces` (id, owner_user_id, name) and `workspace_guilds`
  (guild_id → workspace_id, one row per guild) are created in V14, which
  also gives every existing guild its own implicit workspace (owner = the
  guild's OWNER member). Guilds seen later get one on first use
  (`WorkspaceService.forGuild`).
- `subscriptions` has one row per workspace: plan, Stripe customer and
  subscription ids, Stripe's status, period end, cancel-at-period-end.
- E4.3 then only moves guilds between workspaces (rows in
  `workspace_guilds`); the subscription schema doesn't change.

### Plan of a guild

`Guild.plan_tier` stays the field limits read (E4.1). Billing writes it:
when a workspace's subscription is `active`, `trialing` or `past_due`
(Stripe's own retry window), every guild of the workspace gets the paid
tier; otherwise `FREE`. A cancellation keeps the tier until the period
ends, because Stripe only deletes the subscription then.

Limits stay **per guild** even inside a multi-guild workspace: one PRO
subscription gives each of its servers PRO limits. Pooling usage across a
workspace is a pricing decision (раздел 7), not needed for the mechanism,
and can be added in `PlanLimitService` without schema changes.

### Stripe integration

- Plain REST calls (customer, Checkout session, Billing Portal session),
  no SDK: three form-encoded calls.
- Webhooks (`/api/v1/public/billing/stripe/webhook`) are verified with the
  endpoint secret (HMAC-SHA256, 5-minute tolerance), recorded by event id
  in `stripe_events` so a redelivery is acknowledged but not applied
  twice, and queued in `outbound_jobs` (ADR 0001) to be applied with
  retries. Events older than the last applied one for a subscription are
  ignored (Stripe doesn't guarantee order), and the end of a replaced
  subscription can't cancel its successor.
- Handled: `checkout.session.completed`,
  `customer.subscription.created/updated/deleted`. The workspace is found
  through metadata set at checkout (`subscription_data.metadata`), then the
  subscription id, then the customer.

## Consequences

- Billing is off until `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO` and
  `STRIPE_WEBHOOK_SECRET` are set; owners then see checkout in the panel.
- Stripe stays the source of truth; the app never charges or cancels by
  itself, so plan changes all go through Checkout or the Billing Portal.
