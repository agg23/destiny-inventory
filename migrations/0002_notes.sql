-- Rows are never deleted. A removal is the flag plus a fresh updated_at

-- target_id is an instance id, a Collections entry key, or a Collections set key. item_hash
-- is only kept for instances
CREATE TABLE notes (
  membership_id TEXT    NOT NULL,
  kind          TEXT    NOT NULL,
  target_id     TEXT    NOT NULL,
  item_hash     INTEGER,
  body          TEXT    NOT NULL,
  removed       INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (membership_id, kind, target_id)
);

CREATE INDEX notes_sync ON notes (membership_id, updated_at);
