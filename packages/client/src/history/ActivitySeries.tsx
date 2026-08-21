import { For, Show } from "solid-js";

import { Chevron, Plate, type PlateProps } from "./ActivityRow.tsx";
import {
  ago,
  duration,
  span,
  type ActivityRow,
  type BucketGroup,
} from "../history.ts";

const SERIES_ROWS = 10;

export const ActivitySeries = (props: {
  groups: BucketGroup[];
  plateOf: (row: ActivityRow) => PlateProps;
  isExpanded: (id: string) => boolean;
  onToggle: (id: string) => void;
  onOpen: (row: ActivityRow) => void;
}) => {
  const rowsOf = (group: BucketGroup): ActivityRow[] =>
    props.isExpanded(group.bucket.id)
      ? group.rows
      : group.rows.slice(0, SERIES_ROWS);

  return (
    <div class="flex flex-col gap-4">
      <For each={props.groups}>
        {(group) => (
          <div class="card">
            <div class="card-header">
              <span class="card-title">{group.bucket.name}</span>
              <span class="card-subtitle tabular-nums">
                {group.runs} entered · {group.cleared} cleared ·{" "}
                {group.deathless} deathless · {span(group.playedSeconds)}
              </span>
            </div>
            <div class="card-body flex flex-col p-0">
              <table class="table">
                <thead>
                  <tr>
                    <th class="w-72">Activity</th>
                    <th />
                    <th class="num w-36">Entered</th>
                    <th class="num w-36">Cleared</th>
                    <th class="num w-36">Fastest</th>
                    <th class="num w-40">Best score</th>
                    <th class="num w-40">Last</th>
                    <th class="w-8" />
                  </tr>
                </thead>
                <tbody>
                  <For each={rowsOf(group)}>
                    {(row) => (
                      <tr
                        class="group cursor-pointer"
                        onClick={() => props.onOpen(row)}
                      >
                        <td class="p-0">
                          <Plate {...props.plateOf(row)} />
                        </td>
                        <td />
                        <td class="num">{row.runs}</td>
                        <td class="num">{row.cleared}</td>
                        <td class="num">
                          {row.fastestSeconds === undefined
                            ? "-"
                            : duration(row.fastestSeconds)}
                        </td>
                        <td class="num">
                          {row.bestScore > 0
                            ? row.bestScore.toLocaleString()
                            : "-"}
                        </td>
                        <td class="num">{ago(row.lastRunAt)}</td>
                        <Chevron />
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
              <Show when={group.rows.length > SERIES_ROWS}>
                <button
                  type="button"
                  class="button small ghost m-3 self-start"
                  aria-pressed={props.isExpanded(group.bucket.id)}
                  onClick={() => props.onToggle(group.bucket.id)}
                >
                  {props.isExpanded(group.bucket.id)
                    ? `Show top ${SERIES_ROWS}`
                    : `Show all ${group.rows.length}`}
                </button>
              </Show>
            </div>
          </div>
        )}
      </For>
    </div>
  );
};
