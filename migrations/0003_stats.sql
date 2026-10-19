-- One row per 5 minute bucket of recorded profile changes. A resend keeps the longer copy

CREATE TABLE stat_chunks (
  membership_id TEXT    NOT NULL,
  starts_at     INTEGER NOT NULL,
  ends_at       INTEGER NOT NULL,
  -- Gzipped JSON
  body          BLOB    NOT NULL,
  -- Of the JSON before gzip
  body_length   INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (membership_id, starts_at)
);

CREATE INDEX stat_chunks_sync ON stat_chunks (membership_id, updated_at, starts_at);
