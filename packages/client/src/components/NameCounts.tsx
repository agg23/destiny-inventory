import type { DimItem } from "app/inventory/item-types";
import { createMemo, For, Show } from "solid-js";

interface NameCount {
  name: string;
  count: number;
}

export const nameCounts = (items: DimItem[]): NameCount[] => {
  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
  }

  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

/** Item names with how many of each, most first */
export const NameCounts = (props: { items: DimItem[]; class?: string }) => {
  const rows = createMemo(() => nameCounts(props.items));

  return (
    <ul class={`flex flex-col text-sm ${props.class ?? ""}`}>
      <For each={rows()}>
        {(row) => (
          <li class="flex items-baseline gap-2 py-0.5">
            <span class="min-w-0 flex-1 truncate">{row.name}</span>
            <Show when={row.count > 1}>
              <span class="text-muted-foreground tabular-nums">
                {row.count}
              </span>
            </Show>
          </li>
        )}
      </For>
    </ul>
  );
};
