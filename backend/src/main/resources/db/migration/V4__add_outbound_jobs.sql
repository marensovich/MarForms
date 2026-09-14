-- ============================================================
-- outbound_jobs — skeleton for the DB-backed job outbox
-- ============================================================
-- See docs/adr/0001-background-job-mechanism.md for the decision this
-- implements. No JPA entity/service exists yet — this is the schema
-- skeleton only; the webhook-delivery queue (#58) is the first consumer.

CREATE TABLE outbound_jobs
(
    id              UUID                        NOT NULL,
    job_type        VARCHAR(50)                 NOT NULL,
    payload         JSONB                       NOT NULL,
    status          VARCHAR(20)                 NOT NULL DEFAULT 'PENDING',
    attempts        INTEGER                     NOT NULL DEFAULT 0,
    max_attempts    INTEGER                     NOT NULL DEFAULT 5,
    next_attempt_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    last_error      TEXT,
    created_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT pk_outbound_jobs PRIMARY KEY (id)
);

-- Poller queries "due, not-yet-exhausted jobs" — index the columns it filters on.
CREATE INDEX idx_outbound_jobs_status_next_attempt ON outbound_jobs (status, next_attempt_at);
