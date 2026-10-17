/** A section's heading, in pages, rails and panels */
export const HEADING = "text-sm font-medium text-foreground";

/** A small label over a value or a list */
export const LABEL = "text-xs font-medium text-muted-foreground";

/** A list row that acts like a menu item */
export const ROW =
  "flex w-full min-w-0 items-center gap-2 rounded-md p-1.5 text-left hover:bg-accent";

/** Struck through, for rewards already claimed this week */
export const SPENT = "text-muted-foreground/60 line-through";

/** Tiles packed as many to a row as fit */
export const TILE_GRID = "grid grid-cols-[repeat(auto-fill,var(--tile))] gap-1";

/** Small card from shadcn */
export const CARD =
  "flex flex-col gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10";

/** Rounded border around a table */
export const TABLE_FRAME = "overflow-hidden rounded-lg border";

/** A page section: its heading over its content */
export const SECTION = "flex min-w-0 flex-col gap-3";

/** A note beside a heading, like a countdown */
export const HEADING_NOTE =
  "text-xs font-normal text-muted-foreground tabular-nums";

/** Small muted header cells and no row hover, for a table's header */
export const TABLE_HEADER =
  "[&_th]:text-xs [&_th]:text-muted-foreground [&_tr]:hover:bg-transparent";

/** Activity art behind a title. Set the art's url() in --art */
export const HERO =
  "flex min-h-50 flex-col items-center justify-center gap-1 bg-[image:linear-gradient(rgb(0_0_0/62%),rgb(0_0_0/74%)),var(--art)] bg-cover bg-center p-6 text-center text-shadow-art";

/** A saved note's text */
export const NOTE_TEXT = "text-xs whitespace-pre-wrap wrap-anywhere";
