import type { DimItem } from "app/inventory/item-types";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  Show,
  type JSX,
} from "solid-js";

import { BungieImage } from "../../components/BungieImage.tsx";
import { Perks } from "../../components/card/Perks.tsx";
import { Changes } from "../../components/card/Stats.tsx";
import { Heading } from "../../components/Heading.tsx";
import { ItemTile } from "../../components/ItemTile.tsx";
import {
  LABEL,
  NOTE_TEXT,
  SECTION,
  TILE_GRID,
} from "../../components/lib/text.ts";
import { dismissPerk, previewPerk } from "../../core/items/perkPreview.ts";
import { iconOf } from "../../core/items/perks.ts";
import { LoadoutRail } from "./LoadoutRail.tsx";
import { classAndSubclass, facts } from "./loadoutFacts.ts";
import type { SharedItem, SharedLoadout, SharedPlug } from "./sharedLoadout.ts";

const PlugIcon = (props: { one: SharedPlug; size: string }) => (
  <span
    class="inline-flex"
    onMouseEnter={(event) =>
      previewPerk(props.one.item, props.one.plug, event.currentTarget)
    }
    onMouseLeave={() => dismissPerk(props.one.plug)}
  >
    <BungieImage
      path={iconOf(props.one.plug.plugDef.displayProperties)}
      class={`${props.size} flex-none`}
      lazy
    />
  </span>
);

const Plugs = (props: { plugs: SharedPlug[] }) => (
  <div class="flex flex-wrap gap-1">
    <For each={props.plugs}>
      {(one) => <PlugIcon one={one} size="size-(--plug)" />}
    </For>
  </div>
);

interface Focus {
  focused: DimItem | undefined;
  onFocus: (item: DimItem) => void;
}

const ModdedTiles = (props: { items: SharedItem[] } & Focus) => (
  <div class={TILE_GRID}>
    <For each={props.items}>
      {(one) => (
        <div class="flex flex-col gap-1">
          <ItemTile
            item={one.item}
            selected={props.focused === one.item}
            onSelect={props.onFocus}
          />
          <Plugs plugs={one.mods} />
        </div>
      )}
    </For>
  </div>
);

const Tiles = (props: { items: DimItem[] } & Focus) => (
  <div class={TILE_GRID}>
    <For each={props.items}>
      {(item) => (
        <ItemTile
          item={item}
          selected={props.focused === item}
          onSelect={props.onFocus}
        />
      )}
    </For>
  </div>
);

const Section = (props: {
  title: string;
  note?: string | number;
  children: JSX.Element;
}) => (
  <section class={SECTION}>
    <Heading note={props.note}>{props.title}</Heading>
    {props.children}
  </section>
);

export const LoadoutView = (props: {
  shared: SharedLoadout;
  needle: string;
}) => {
  const named = <T,>(list: T[], name: (one: T) => string): T[] =>
    props.needle === ""
      ? list
      : list.filter((one) => name(one).toLowerCase().includes(props.needle));

  const subclass = () =>
    named(
      props.shared.subclass ? [props.shared.subclass] : [],
      (item) => item.name,
    )[0];
  const equipped = () => named(props.shared.equipped, (one) => one.item.name);
  const unequipped = () => named(props.shared.unequipped, (item) => item.name);
  const plugName = (one: SharedPlug) => one.plug.plugDef.displayProperties.name;
  const mods = () => named(props.shared.mods, plugName);
  const artifact = () => named(props.shared.artifact, plugName);
  const listed = createMemo(() => facts(props.shared.loadout));

  const [focused, setFocused] = createSignal<DimItem | undefined>(undefined);
  const onFocus = (item: DimItem) =>
    setFocused((was) => (was === item ? undefined : item));

  createEffect(
    on(
      () => props.shared,
      () => setFocused(undefined),
      { defer: true },
    ),
  );

  return (
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-1">
        <Heading
          note={classAndSubclass(
            props.shared.loadout.classType,
            props.shared.subclass?.name,
          )}
        >
          {props.shared.loadout.name || "Untitled loadout"}
        </Heading>
        <Show when={props.shared.loadout.notes}>
          {(notes) => (
            <p class={`${NOTE_TEXT} max-w-prose text-muted-foreground`}>
              {notes()}
            </p>
          )}
        </Show>
        <Show when={subclass()}>
          {(subclass) => (
            // Fragments take their own row
            <div
              class="grid w-fit grid-cols-[repeat(3,auto)] gap-x-6 [&>:nth-child(n+4)]:col-span-full"
              style={{ "--plug": "var(--tile)" }}
            >
              <Perks item={subclass()} onlyPlugged />
              <Show when={props.shared.stats.length > 0}>
                <div>
                  <h4 class={`${LABEL} mt-3 mb-1.5 flex h-6 items-center`}>
                    Stats
                  </h4>
                  <Changes stats={props.shared.stats} />
                </div>
              </Show>
            </div>
          )}
        </Show>
      </div>

      <Show
        when={
          artifact().length > 0 || (!props.needle && props.shared.artifactItem)
        }
      >
        <Section
          title="Artifact"
          note={
            props.shared.loadout.parameters?.artifactUnlocks
              ? `Season ${props.shared.loadout.parameters.artifactUnlocks.seasonNumber}`
              : undefined
          }
        >
          <div class={TILE_GRID}>
            <Show when={props.shared.artifactItem}>
              {(item) => (
                <ItemTile
                  item={item()}
                  selected={focused() === item()}
                  onSelect={onFocus}
                />
              )}
            </Show>
            <For each={artifact()}>
              {(one) => <PlugIcon one={one} size="size-(--tile)" />}
            </For>
          </div>
        </Section>
      </Show>

      <Show when={equipped().length > 0}>
        <Section title="Equipped" note={equipped().length}>
          <ModdedTiles
            items={equipped()}
            focused={focused()}
            onFocus={onFocus}
          />
        </Section>
      </Show>

      <Show when={unequipped().length > 0}>
        <Section title="Unequipped" note={unequipped().length}>
          <Tiles items={unequipped()} focused={focused()} onFocus={onFocus} />
        </Section>
      </Show>

      <Show when={props.shared.exotic}>
        {(exotic) => (
          <Section title="Exotic">
            <Tiles items={[exotic()]} focused={focused()} onFocus={onFocus} />
          </Section>
        )}
      </Show>

      <Show when={mods().length > 0}>
        <Section
          title={props.shared.armor ? "Unassigned mods" : "Mods"}
          note={mods().length}
        >
          <Plugs plugs={mods()} />
        </Section>
      </Show>

      <Show when={listed().length > 0}>
        <Section title="Settings">
          <dl class="grid w-fit grid-cols-[auto_auto] items-baseline gap-x-6 gap-y-1">
            <For each={listed()}>
              {([label, value]) => (
                <>
                  <dt class={LABEL}>{label}</dt>
                  <dd class="tabular-nums">{value}</dd>
                </>
              )}
            </For>
          </dl>
        </Section>
      </Show>

      <LoadoutRail
        shared={props.shared}
        focused={focused()}
        onClose={() => setFocused(undefined)}
      />
    </div>
  );
};
