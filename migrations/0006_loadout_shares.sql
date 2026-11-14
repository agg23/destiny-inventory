-- dim.gg shares can't be edited, so a row never changes

-- loadout is the DIM API loadout as JSON
CREATE TABLE loadout_shares (
  share_id   TEXT    PRIMARY KEY,
  loadout    TEXT    NOT NULL,
  fetched_at INTEGER NOT NULL
);
