-- History of a submission (#118, ТЗ 4.5): sent, decided, decision reopened by the
-- owner, sent again after revision. A decision no longer just overwrites the row.
CREATE TABLE submission_events
(
    id               UUID PRIMARY KEY,
    submission_id    UUID        NOT NULL REFERENCES submission (id) ON DELETE CASCADE,
    type             VARCHAR(32) NOT NULL,
    from_status      VARCHAR(32),
    to_status        VARCHAR(32) NOT NULL,
    actor_discord_id BIGINT,
    comment          TEXT,
    created_at       TIMESTAMP   NOT NULL
);

CREATE INDEX idx_submission_events_submission ON submission_events (submission_id, created_at);

-- What is known of existing submissions: when they were sent, and their current decision.
INSERT INTO submission_events (id, submission_id, type, from_status, to_status, actor_discord_id, comment, created_at)
SELECT gen_random_uuid(), s.id, 'SUBMITTED', NULL, 'PENDING', s.discord_id, NULL, s.created_at
FROM submission s;

INSERT INTO submission_events (id, submission_id, type, from_status, to_status, actor_discord_id, comment, created_at)
SELECT gen_random_uuid(), s.id, 'DECIDED', 'PENDING', s.status, s.moderator_discord_id, s.moderator_comment,
       COALESCE(s.decided_at, s.created_at)
FROM submission s
WHERE s.status <> 'PENDING';
