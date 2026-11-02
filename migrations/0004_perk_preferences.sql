-- Rows are never deleted. Going back to neutral is the flag plus a fresh updated_at

-- perk is the display name. Enhanced versions share it
CREATE TABLE perk_preferences (
  membership_id TEXT    NOT NULL,
  mode          TEXT    NOT NULL,
  perk          TEXT    NOT NULL,
  stance        TEXT    NOT NULL,
  removed       INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (membership_id, mode, perk)
);

CREATE INDEX perk_preferences_sync ON perk_preferences (membership_id, updated_at);
