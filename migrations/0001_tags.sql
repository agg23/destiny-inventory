-- Rows are never deleted. A removal is the flag plus a fresh updated_at

CREATE TABLE tag_defs (
  membership_id TEXT    NOT NULL,
  id            TEXT    NOT NULL,
  label         TEXT    NOT NULL,
  color         TEXT    NOT NULL,
  position      INTEGER NOT NULL,
  removed       INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (membership_id, id)
);

-- item_hash is kept alongside the instance. A dismantled instance leaves a row that still
-- says what it was about
CREATE TABLE item_tags (
  membership_id TEXT    NOT NULL,
  instance_id   TEXT    NOT NULL,
  item_hash     INTEGER NOT NULL,
  tag_id        TEXT    NOT NULL,
  removed       INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (membership_id, instance_id, tag_id)
);

CREATE INDEX tag_defs_sync ON tag_defs (membership_id, updated_at);

CREATE INDEX item_tags_sync ON item_tags (membership_id, updated_at);
