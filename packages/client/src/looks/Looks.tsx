import { ItemRarityMap } from "app/search/d2-known-values";
import { plainString } from "app/search/text-utils";
import type { TierType } from "bungie-api-ts/destiny2";
import {
  createMemo,
  createResource,
  createSignal,
  For,
  lazy,
  onMount,
  Show,
  Suspense,
} from "solid-js";

import {
  LOOK_SLOTS,
  SHADER_COLORS,
  type LookArmor,
  type LookDefault,
  type LookItem,
  type LookOrnament,
  type LookSlot,
  type ShaderColor,
} from "@dvm/defs-core";
import type { Look, LookPiece } from "@dvm/service";

import { useEntryPreview } from "../collections/shared/collectionData.ts";
import { CLASS_LABELS } from "../collections/shared/Filters.tsx";
import { ConfirmDialog } from "../components/ConfirmDialog.tsx";
import { Heading } from "../components/Heading.tsx";
import { cn } from "../components/lib/cn.ts";
import { IconButton } from "../components/lib/IconButton.tsx";
import { PickOne } from "../components/lib/PickOne.tsx";
import { HEADING_NOTE, LABEL, ROW, TILE_GRID } from "../components/lib/text.ts";
import { Toggle } from "../components/lib/Toggle.tsx";
import { Button } from "../components/lib/zaidan/button.tsx";
import { Import, X } from "../components/lib/zaidan/icons.tsx";
import { Input } from "../components/lib/zaidan/input.tsx";
import { Tile } from "../components/Tile.tsx";
import { useApp } from "../core/app/state.ts";
import { acquiredFor } from "../core/collections/ownership.ts";
import { CLASSES } from "../core/collections/terms.ts";
import type { Ownership } from "../core/collections/types.ts";
import { messageOf } from "../core/error.ts";
import { lookItems, unlockedPlugs } from "../core/looks/lookData.ts";
import { savedLooks, syncLooks, writeLook } from "../core/looks/savedLooks.ts";
import { showToast } from "../core/toast.ts";
import { currentPieces } from "./shared/currentPieces.ts";
import {
  classType,
  editing,
  EMPTY_PIECE,
  female,
  ownedOnly,
  picking,
  piecesByClass,
  PICK_KINDS,
  setClassType,
  setEditing,
  setFemale,
  setOwnedOnly,
  setPicking,
  setPiecesByClass,
  SLOT_LABELS,
  slotStatus,
  type PickKind,
  type Pieces,
} from "./shared/lookState.ts";

const Viewer = lazy(() =>
  import("./shared/Viewer.tsx").then((module) => ({ default: module.Viewer })),
);

const KIND_LABELS: Record<PickKind, string> = {
  armor: "Armor",
  shader: "Shader",
};

const BODIES = ["a", "b"] as const;

const BODY_LABELS: Record<(typeof BODIES)[number], string> = {
  a: "Body A",
  b: "Body B",
};

// A full five piece set for every class
const DEFAULT_SET = "Wild Hunt";

// TierType.Exotic
const EXOTIC = 6;

const fits = (
  ornament: LookOrnament,
  armor: LookArmor | undefined,
): boolean => {
  if (ornament.items) {
    return (
      !!armor && armor.hashes.some((hash) => ornament.items!.includes(hash))
    );
  }

  return !armor || armor.tierType !== EXOTIC;
};

const COLOR_WORDS: Record<string, ShaderColor> = {
  ...Object.fromEntries(SHADER_COLORS.map((color) => [color, color])),
  gray: "grey",
  silver: "grey",
  gold: "yellow",
  cyan: "teal",
  violet: "purple",
  magenta: "pink",
};

const setOf = (entry: LookItem): string | undefined =>
  entry.kind === "armor" || entry.kind === "ornament" ? entry.set : undefined;

const hashIn = (piece: LookPiece, kind: PickKind): number | undefined =>
  kind === "armor" ? (piece.ornamentHash ?? piece.armorHash) : piece.shaderHash;

export const Looks = () => {
  const app = useApp();
  const hover = useEntryPreview();

  const [items] = createResource(lookItems);
  const session = () => app.loaded()?.session;
  const guest = () => !!app.loaded()?.session.guest;

  const [acquired] = createResource(
    () => {
      const current = session();

      return current === undefined
        ? undefined
        : `${current.membership.membershipId}:${current.builtFrom}`;
    },
    // The key needs a session
    () => acquiredFor(session()!),
  );
  const [unlocked] = createResource(session, unlockedPlugs);

  onMount(() => {
    void syncLooks();
  });

  const byHash = createMemo(() => {
    const found = new Map<number, LookItem>();

    for (const entry of items() ?? []) {
      for (const hash of entry.hashes) {
        found.set(hash, entry);
      }
    }

    return found;
  });

  const defaultShader = (): LookDefault | undefined =>
    (items() ?? []).find(
      (entry): entry is LookDefault => entry.kind === "default",
    );

  const held = createMemo(() => {
    const counts = new Map<number, number>();

    for (const store of app.stores()) {
      for (const item of store.items) {
        if (item.bucket.inArmor) {
          counts.set(item.hash, (counts.get(item.hash) ?? 0) + 1);
        }
      }
    }

    return counts;
  });

  const copies = (entry: LookItem): number =>
    entry.kind === "armor"
      ? entry.hashes.reduce((total, hash) => total + (held().get(hash) ?? 0), 0)
      : 0;

  const ownership = (entry: LookItem): Ownership | undefined => {
    if (entry.kind === "default") {
      return undefined;
    }

    if (copies(entry) > 0) {
      return "owned";
    }

    const plugs = unlocked.latest;

    if (entry.kind !== "armor" && plugs?.size) {
      if (entry.hashes.some((hash) => plugs.has(hash))) {
        return "unlocked";
      }
    }

    const collected = acquired.latest;

    if (!collected) {
      return undefined;
    }

    return entry.collectibleHashes.some((hash) => collected.has(hash))
      ? "unlocked"
      : "neverseen";
  };

  const defaultPieces = (forClass: number): Pieces => {
    const all = items() ?? [];

    return Object.fromEntries(
      LOOK_SLOTS.map((slot) => {
        const armor = all.find(
          (entry) =>
            entry.kind === "armor" &&
            entry.classType === forClass &&
            entry.slot === slot &&
            entry.name.startsWith(DEFAULT_SET),
        );

        return [slot, { ...EMPTY_PIECE, armorHash: armor?.hash }];
      }),
    ) as Pieces;
  };

  const pieces = (): Pieces =>
    piecesByClass()[classType()] ?? defaultPieces(classType());

  const setPieces = (next: Pieces) =>
    setPiecesByClass((all) => ({ ...all, [classType()]: next }));

  const entryFor = <T extends LookItem>(
    hash: number | undefined,
  ): T | undefined =>
    hash === undefined ? undefined : (byHash().get(hash) as T | undefined);

  // Nothing chosen shows the game's default item
  const shownIn = (slot: LookSlot, kind: PickKind): LookItem | undefined =>
    entryFor(hashIn(pieces()[slot], kind)) ??
    (kind === "shader" ? defaultShader() : undefined);

  const choose = (entry: LookItem) => {
    const { slot } = picking();
    const piece = pieces()[slot];
    let next: LookPiece = piece;

    if (entry.kind === "default") {
      next = { ...piece, shaderHash: undefined };
    } else if (entry.kind === "shader") {
      next = { ...piece, shaderHash: entry.hash };
    } else if (entry.kind === "armor") {
      next = { ...piece, armorHash: entry.hash, ornamentHash: undefined };
    } else {
      const current = entryFor<LookArmor>(piece.armorHash);
      // An item-specific ornament needs its own armor underneath
      const base = entry.items
        ? entryFor<LookArmor>(entry.items[0])
        : current && fits(entry, current)
          ? current
          : undefined;

      next = { ...piece, armorHash: base?.hash, ornamentHash: entry.hash };
    }

    setPieces({ ...pieces(), [slot]: next });
  };

  const shaderEverywhere = () => {
    const shaderHash = pieces()[picking().slot].shaderHash;

    setPieces(
      Object.fromEntries(
        LOOK_SLOTS.map((slot) => [slot, { ...pieces()[slot], shaderHash }]),
      ) as Pieces,
    );
  };

  const needle = createMemo(() =>
    plainString(app.query().trim().toLowerCase(), "en"),
  );

  const choices = createMemo(() => {
    const { slot, kind } = picking();
    const forClass = classType();
    const words = needle()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    const colors = words.flatMap((word) =>
      COLOR_WORDS[word] === undefined ? [] : [COLOR_WORDS[word]],
    );
    const onlyOwned = ownedOnly();
    const fallback = kind === "shader" ? defaultShader() : undefined;

    const matching = (items() ?? []).filter((entry) => {
      if (entry.kind === "armor" || entry.kind === "ornament") {
        if (
          kind !== "armor" ||
          entry.classType !== forClass ||
          entry.slot !== slot
        ) {
          return false;
        }
      } else if (kind !== "shader" || entry.kind !== "shader") {
        return false;
      }

      const searched = [entry.name, setOf(entry) ?? "", entry.source ?? ""]
        .map((field) => plainString(field.toLowerCase(), "en"))
        .join("\n");
      const found = words.every((word) =>
        entry.kind === "shader" && COLOR_WORDS[word] !== undefined
          ? entry.colors[COLOR_WORDS[word]] !== undefined
          : searched.includes(word),
      );

      if (!found) {
        return false;
      }

      return !onlyOwned || ownership(entry) !== "neverseen";
    });

    const share = (entry: LookItem): number =>
      entry.kind === "shader"
        ? colors.reduce((total, color) => total + (entry.colors[color] ?? 0), 0)
        : 0;

    matching.sort((a, b) => share(b) - share(a) || b.tierType - a.tierType);

    return fallback ? [fallback, ...matching] : matching;
  });

  const otherSets = createMemo(() => {
    const { slot: picked, kind } = picking();

    return [
      ...new Set(
        LOOK_SLOTS.flatMap((slot) => {
          if (slot === picked) {
            return [];
          }

          const entry = entryFor(hashIn(pieces()[slot], kind));
          const set = entry && setOf(entry);

          return set === undefined ? [] : [set];
        }),
      ),
    ];
  });

  const inSets = createMemo(() => {
    const sets = otherSets();
    const current = shownIn(picking().slot, picking().kind);

    return choices()
      .filter(
        (entry) => entry !== current && sets.includes(setOf(entry) ?? ""),
      )
      .sort((a, b) => sets.indexOf(setOf(a)!) - sets.indexOf(setOf(b)!));
  });

  const outsideSets = createMemo(() => {
    const matched = new Set(inSets());

    return choices().filter((entry) => !matched.has(entry));
  });

  const shown = createMemo(() =>
    LOOK_SLOTS.map((slot) => {
      const piece = pieces()[slot];

      return {
        slot,
        itemHash: piece.ornamentHash ?? piece.armorHash,
        shaderHash: piece.shaderHash,
      };
    }),
  );

  const [name, setName] = createSignal(editing()?.name ?? "");
  const [removing, setRemoving] = createSignal<Look | undefined>(undefined);

  const save = async (asNew: boolean) => {
    const current = editing();
    const id = !asNew && current ? current.id : crypto.randomUUID();
    const trimmed = name().trim() || "Untitled look";
    const saved = await writeLook({
      id,
      name: trimmed,
      classType: classType(),
      female: female(),
      pieces: pieces(),
      removed: false,
    }).catch((e: unknown) => {
      showToast(messageOf(e), "danger");

      return false;
    });

    if (!saved) {
      showToast("Look not saved", "danger");

      return;
    }

    setEditing({ id, name: trimmed });
    setName(trimmed);
  };

  const open = (look: Look) => {
    setClassType(look.classType);
    setFemale(look.female);
    setPiecesByClass((all) => ({ ...all, [look.classType]: look.pieces }));
    setEditing({ id: look.id, name: look.name });
    setName(look.name);
  };

  const remove = async (look: Look) => {
    setRemoving(undefined);

    const done = await writeLook({ ...look, removed: true });

    if (!done) {
      showToast("Look not removed", "danger");

      return;
    }

    if (editing()?.id === look.id) {
      setEditing(undefined);
    }
  };

  // The most recently played character of the picked class
  const matchingCharacter = () =>
    app
      .stores()
      .filter((store) => !store.isVault && store.classType === classType())
      .sort((a, b) => b.lastPlayed.getTime() - a.lastPlayed.getTime())[0];

  const importCharacter = () => {
    const store = matchingCharacter();

    if (!store) {
      return;
    }

    setFemale(store.genderName === "female");
    setPieces(
      currentPieces(store, (hash) => hash !== undefined && byHash().has(hash)),
    );
    setEditing(undefined);
    setName("");
  };

  const LookTile = (props: {
    entry: LookItem;
    selected: boolean;
    onClick: () => void;
  }) => (
    <Tile
      name={props.entry.name}
      icon={props.entry.icon}
      overlay={undefined}
      rarity={
        props.entry.kind === "default"
          ? ""
          : (ItemRarityMap[props.entry.tierType as TierType] ?? "Common")
      }
      classes={[
        props.entry.kind === "default" ? "empty-socket" : "",
        ownership(props.entry) ?? "",
        props.selected ? "selected" : "",
      ]}
      gearTier={0}
      corner={copies(props.entry) || undefined}
      cornerClass="owned-count"
      tagColor={undefined}
      favorite={false}
      icons={[]}
      tiers={() => undefined}
      onClick={() => props.onClick()}
      onEnter={(element) =>
        hover.enter({ newestItemHash: props.entry.hash }, element, [])
      }
      onLeave={hover.leave}
    />
  );

  const Cell = (props: { slot: LookSlot; kind: PickKind }) => {
    const selected = () =>
      picking().slot === props.slot && picking().kind === props.kind;
    const pick = () => setPicking({ slot: props.slot, kind: props.kind });

    return (
      <Show
        when={shownIn(props.slot, props.kind)}
        fallback={
          <button
            type="button"
            aria-label={`${SLOT_LABELS[props.slot]} ${KIND_LABELS[props.kind]}`}
            class="size-(--tile) rounded-sm border border-dashed border-foreground/20 hover:border-foreground/50"
            classList={{ "border-foreground! border-solid": selected() }}
            onClick={pick}
          />
        }
      >
        {(entry) => (
          <LookTile entry={entry()} selected={selected()} onClick={pick} />
        )}
      </Show>
    );
  };

  const busy = () =>
    (!items() && !items.error) ||
    LOOK_SLOTS.some((slot) => slotStatus()[slot].kind === "loading");

  const SlotLabel = (props: { slot: LookSlot }) => {
    const status = () => slotStatus()[props.slot];
    const failure = () => {
      const now = status();

      return now.kind === "failed" ? now.message : undefined;
    };

    return (
      <span
        class={cn(
          "text-xs font-medium",
          failure() === undefined
            ? "text-muted-foreground"
            : "text-destructive",
        )}
        title={failure()}
      >
        {SLOT_LABELS[props.slot]}
      </span>
    );
  };

  return (
    <div class="look-page flex h-[calc(100dvh-var(--header-h,49px))] min-h-0 gap-4 p-4">
      <div class="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto">
        <PickOne
          value={CLASSES[classType()]}
          options={CLASSES}
          label={(one) => CLASS_LABELS[one]}
          onChange={(one) => setClassType(CLASSES.indexOf(one))}
        />
        <div class="flex items-center gap-2">
          <PickOne
            value={female() ? "b" : "a"}
            options={BODIES}
            label={(one) => BODY_LABELS[one]}
            onChange={(one) => setFemale(one === "b")}
          />
          <Show when={app.stores().length > 0}>
            <Button
              variant="outline"
              disabled={!matchingCharacter()}
              title={
                matchingCharacter()
                  ? undefined
                  : `No ${CLASS_LABELS[CLASSES[classType()]!]} character`
              }
              onClick={importCharacter}
            >
              <Import />
              Import {CLASS_LABELS[CLASSES[classType()]!]}
            </Button>
          </Show>
        </div>

        <div class="flex flex-col gap-1.5">
          <div class="grid grid-cols-[1fr_repeat(2,var(--tile))] gap-1.5">
            <span />
            <For each={PICK_KINDS}>
              {(kind) => <span class={LABEL}>{KIND_LABELS[kind]}</span>}
            </For>
          </div>
          <For each={LOOK_SLOTS}>
            {(slot) => (
              <div class="grid grid-cols-[1fr_repeat(2,var(--tile))] items-center gap-1.5">
                <SlotLabel slot={slot} />
                <For each={PICK_KINDS}>
                  {(kind) => <Cell slot={slot} kind={kind} />}
                </For>
              </div>
            )}
          </For>
        </div>

        <Show when={!guest()}>
          <div class="flex flex-col gap-1.5">
            <Heading>Saved</Heading>
            <div class="flex gap-1.5">
              <Input
                class="h-7"
                placeholder="Look name"
                aria-label="Look name"
                maxLength={100}
                value={name()}
                onInput={(event) => setName(event.currentTarget.value)}
              />
              <Button size="sm" onClick={() => void save(false)}>
                Save
              </Button>
            </div>
            <Show when={editing()}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void save(true)}
              >
                Save as new
              </Button>
            </Show>
            <div class="flex flex-col">
              <For each={savedLooks()}>
                {(look) => (
                  <div class="flex items-center gap-0.5">
                    <button
                      type="button"
                      class={`${ROW} flex-1`}
                      classList={{ "bg-muted": editing()?.id === look.id }}
                      onClick={() => open(look)}
                    >
                      <span class="truncate">{look.name}</span>
                      <span class={`${HEADING_NOTE} shrink-0`}>
                        {CLASS_LABELS[CLASSES[look.classType]!]}
                      </span>
                    </button>
                    <IconButton
                      size="icon-sm"
                      class="text-muted-foreground"
                      label="Remove"
                      onClick={() => setRemoving(look)}
                    >
                      <X />
                    </IconButton>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>

      <div class="relative min-w-0 flex-1">
        <Show
          when={items()}
          fallback={
            <Show when={items.error}>
              <p class="text-destructive">{messageOf(items.error)}</p>
            </Show>
          }
        >
          <Suspense>
            <Viewer pieces={shown()} female={female()} />
          </Suspense>
        </Show>
        <Show when={busy()}>
          <div class="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60">
            <span
              class="size-12 animate-spin rounded-full border-4 border-muted-foreground/30 border-t-foreground"
              aria-label="Loading"
            />
          </div>
        </Show>
      </div>

      <div class="flex w-[calc(var(--tile)*6+2.75rem)] shrink-0 flex-col gap-3 overflow-hidden">
        <div class="flex items-center gap-3">
          <Heading
            note={choices().filter((entry) => entry.kind !== "default").length}
          >
            {SLOT_LABELS[picking().slot]}{" "}
            {KIND_LABELS[picking().kind].toLowerCase()}
          </Heading>
          <Show when={picking().kind === "shader"}>
            <Button variant="outline" size="xs" onClick={shaderEverywhere}>
              Apply to all
            </Button>
          </Show>
          <div class="ml-auto">
            <Toggle
              label="Owned only"
              checked={ownedOnly()}
              onChange={setOwnedOnly}
            />
          </div>
        </div>
        <div class="flex flex-col gap-3 overflow-y-auto p-1 pb-4">
          <Show when={inSets().length > 0}>
            <div class="flex flex-col gap-1.5">
              <span class={LABEL}>Matching sets</span>
              <div class={TILE_GRID}>
                <For each={inSets()}>
                  {(entry) => (
                    <LookTile
                      entry={entry}
                      selected={
                        shownIn(picking().slot, picking().kind) === entry
                      }
                      onClick={() => choose(entry)}
                    />
                  )}
                </For>
              </div>
            </div>
          </Show>
          <div class={TILE_GRID}>
            <For each={outsideSets()}>
              {(entry) => (
                <LookTile
                  entry={entry}
                  selected={shownIn(picking().slot, picking().kind) === entry}
                  onClick={() => choose(entry)}
                />
              )}
            </For>
          </div>
        </div>
      </div>

      <ConfirmDialog
        value={removing()}
        action="Remove"
        onClose={() => setRemoving(undefined)}
        onAction={() => void remove(removing()!)}
      >
        {(look) => <p>Remove the saved look "{look().name}"?</p>}
      </ConfirmDialog>
    </div>
  );
};
