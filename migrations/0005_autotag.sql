-- NULL when the tag was set by hand
ALTER TABLE item_tags ADD COLUMN rule_id TEXT;

CREATE TABLE autotag_rules (
  membership_id TEXT    NOT NULL,
  id            TEXT    NOT NULL,
  query         TEXT    NOT NULL,
  tag_id        TEXT,
  vault         INTEGER NOT NULL,
  enabled       INTEGER NOT NULL,
  position      INTEGER NOT NULL,
  removed       INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (membership_id, id)
);

CREATE INDEX autotag_rules_sync ON autotag_rules (membership_id, updated_at);

-- Instance ids pass 2^53, so mark is zero padded text
CREATE TABLE autotag_state (
  membership_id TEXT    NOT NULL PRIMARY KEY,
  enabled       INTEGER NOT NULL,
  mark          TEXT    NOT NULL,
  updated_at    INTEGER NOT NULL
);
