-- Source: seed/schema.sql (read-only; this migration adapts it, never edits it).
--
-- Adapted, per PLAN.md §5:
--   1. CHECK (event_type IN (...)) on the three known event types, since the column was a
--      free-text VARCHAR in the source with no constraint.
--   2. CHECK (duration_seconds >= 0), for the same reason.
--   3. An index on (account_id, event_type, occurred_at), to support the weekly aggregation
--      query, which the source schema had no indexes for at all.
--   4. Deliberately NO unique constraint across the event columns: the seed has 12 groups of
--      exact-duplicate rows, and a unique constraint would make them fail to load.
--
-- Column types, nullability and primary keys are otherwise unchanged from the source.

-- Up Migration

CREATE TABLE accounts (
    id          INTEGER      NOT NULL PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    industry    VARCHAR(60)  NOT NULL,
    timezone    VARCHAR(60)  NOT NULL,
    created_at  TIMESTAMP    NOT NULL
);

CREATE TABLE activity_events (
    id                INTEGER      NOT NULL PRIMARY KEY,
    account_id        INTEGER      NOT NULL REFERENCES accounts(id),
    location          VARCHAR(80)  NOT NULL,
    event_type        VARCHAR(40)  NOT NULL
                      CHECK (event_type IN ('call_received', 'lead_created', 'appointment_set')),
    occurred_at       TIMESTAMP    NOT NULL,
    duration_seconds  INTEGER      NULL CHECK (duration_seconds >= 0),
    outcome           VARCHAR(40)  NULL
);

CREATE INDEX activity_events_account_type_occurred_idx
    ON activity_events (account_id, event_type, occurred_at);

-- Down Migration

DROP TABLE activity_events;
DROP TABLE accounts;
