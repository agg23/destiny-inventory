-- Rows are never deleted. A removal is the flag plus a fresh updated_at

-- pieces is the JSON of every slot's armor, ornament, and shader hash
CREATE TABLE looks (
  membership_id TEXT    NOT NULL,
  look_id       TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  class_type    INTEGER NOT NULL,
  female        INTEGER NOT NULL,
  pieces        TEXT    NOT NULL,
  removed       INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (membership_id, look_id)
);

CREATE INDEX looks_sync ON looks (membership_id, updated_at);
