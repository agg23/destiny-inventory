import { ItemRarityMap } from "app/search/d2-known-values";
import { plainString } from "app/search/text-utils";
import type { TierType } from "bungie-api-ts/destiny2";
import {
  createEffect,
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
  type LookWeapon,
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
import { NativeSelect } from "../components/lib/zaidan/native-select.tsx";
import { Tile } from "../components/Tile.tsx";
import { useApp } from "../core/app/state.ts";
import { acquiredFor } from "../core/collections/ownership.ts";
import { CLASSES, type ClassName } from "../core/collections/terms.ts";
import type { Ownership } from "../core/collections/types.ts";
import { messageOf } from "../core/error.ts";
import { lookItems, unlockedPlugs } from "../core/looks/lookData.ts";
import { savedLooks, syncLooks, writeLook } from "../core/looks/savedLooks.ts";
import { useUrl } from "../core/router.ts";
import { showToast } from "../core/toast.ts";
import {
  BODIES,
  LOOK_MODES,
  type LookMode,
  type ParamKey,
  type Params,
} from "../core/url.ts";
import { currentPieces } from "./shared/currentPieces.ts";
import {
  armorPicking,
  classType,
  EMPTY_PIECE,
  female,
  mode,
  ownedOnly,
  piecesByClass,
  PICK_KINDS,
  poseLoading,
  setArmorPicking,
  setClassType,
  setFemale,
  setMode,
  setOwnedOnly,
  setPiecesByClass,
  setWeapon,
  setWeaponPicking,
  SLOT_LABELS,
  slotStatus,
  weapon,
  WEAPON,
  weaponPicking,
  type Picking,
  type PickKind,
  type PickSlot,
  type Pieces,
} from "./shared/lookState.ts";

const Viewer = lazy(() =>
  import("./shared/Viewer.tsx").then((module) => ({ default: module.Viewer })),
);

const MODE_LABELS: Record<LookMode, string> = {
  armor: "Armor",
  weapons: "Weapons",
};

const SETTING_ROW =
  "grid grid-cols-[1fr_repeat(2,var(--tile))] items-center gap-1.5";

const SETTING_LABEL = "text-xs font-medium text-muted-foreground";

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

const SLOT_PARAMS = {
  helmet: "helmet",
  arms: "arms",
  chest: "chest",
  legs: "legs",
  class: "classitem",
} as const satisfies Record<LookSlot, ParamKey>;

const hashIds = (hashes: (number | undefined)[]): string[] => {
  const ids = hashes.map((hash) => hash?.toString() ?? "");

  while (ids.at(-1) === "") {
    ids.pop();
  }

  return ids;
};

const idHashes = (ids: string[]): (number | undefined)[] =>
  [0, 1, 2].map((index) => {
    const parsed = Number.parseInt(ids[index] ?? "", 10);

    return Number.isFinite(parsed) ? parsed : undefined;
  });

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

  const url = useUrl();

  if (url.get("mode") === "weapons") {
    const [weaponHash, ornamentHash, shaderHash] = idHashes(url.get("weapon"));

    setMode("weapons");

    if (weaponHash !== undefined) {
      setWeapon({ weaponHash, ornamentHash, shaderHash });
    }
  } else if (
    LOOK_SLOTS.some((slot) => url.get(SLOT_PARAMS[slot]).length > 0)
  ) {
    const forClass = CLASSES.indexOf(url.get("class"));
    const shared = Object.fromEntries(
      LOOK_SLOTS.map((slot) => {
        const [armorHash, ornamentHash, shaderHash] = idHashes(
          url.get(SLOT_PARAMS[slot]),
        );

        return [slot, { armorHash, ornamentHash, shaderHash }];
      }),
    ) as Pieces;

    setMode("armor");
    setClassType(forClass);
    setFemale(url.get("body") === "b");
    setPiecesByClass((all) => ({ ...all, [forClass]: shared }));
  }

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
        if (item.bucket.inArmor || item.bucket.inWeapons) {
          counts.set(item.hash, (counts.get(item.hash) ?? 0) + 1);
        }
      }
    }

    return counts;
  });

  const copies = (entry: LookItem): number =>
    entry.kind === "armor" || entry.kind === "weapon"
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

    if (entry.kind !== "armor" && entry.kind !== "weapon" && plugs?.size) {
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

  const picking = (): Picking =>
    mode() === "armor" ? armorPicking() : weaponPicking();

  const setPicking = (next: Picking) =>
    mode() === "armor" ? setArmorPicking(next) : setWeaponPicking(next);

  const kindLabel = (kind: PickKind): string =>
    kind === "shader" ? "Shader" : mode() === "armor" ? "Armor" : "Weapon";

  const hashAt = (slot: PickSlot, kind: PickKind): number | undefined => {
    if (slot === WEAPON) {
      const piece = weapon();

      return kind === "gear"
        ? (piece.ornamentHash ?? piece.weaponHash)
        : piece.shaderHash;
    }

    const piece = pieces()[slot];

    return kind === "gear"
      ? (piece.ornamentHash ?? piece.armorHash)
      : piece.shaderHash;
  };

  // Nothing chosen shows the game's default item
  const shownIn = (slot: PickSlot, kind: PickKind): LookItem | undefined =>
    entryFor(hashAt(slot, kind)) ??
    (kind === "shader" ? defaultShader() : undefined);

  const chooseWeapon = (entry: LookItem) => {
    const piece = weapon();

    if (entry.kind === "default") {
      setWeapon({ ...piece, shaderHash: undefined });
    } else if (entry.kind === "shader") {
      setWeapon({ ...piece, shaderHash: entry.hash });
    } else if (entry.kind === "weapon") {
      setWeapon({ ...piece, weaponHash: entry.hash, ornamentHash: undefined });
    } else if (entry.kind === "weaponOrnament") {
      const current = entryFor<LookWeapon>(piece.weaponHash);
      const base = current?.hashes.some((hash) => entry.items.includes(hash))
        ? current
        : entryFor<LookWeapon>(entry.items[0]);

      setWeapon({ ...piece, weaponHash: base?.hash, ornamentHash: entry.hash });
    }
  };

  const choose = (entry: LookItem) => {
    const { slot } = picking();

    if (slot === WEAPON) {
      chooseWeapon(entry);

      return;
    }

    const piece = pieces()[slot];
    let next: LookPiece = piece;

    if (entry.kind === "default") {
      next = { ...piece, shaderHash: undefined };
    } else if (entry.kind === "shader") {
      next = { ...piece, shaderHash: entry.hash };
    } else if (entry.kind === "armor") {
      next = { ...piece, armorHash: entry.hash, ornamentHash: undefined };
    } else if (entry.kind === "ornament") {
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
    const shaderHash = hashAt(picking().slot, "shader");

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
          kind !== "gear" ||
          entry.classType !== forClass ||
          entry.slot !== slot
        ) {
          return false;
        }
      } else if (entry.kind === "weapon" || entry.kind === "weaponOrnament") {
        if (kind !== "gear" || slot !== WEAPON) {
          return false;
        }
      } else if (kind !== "shader" || entry.kind !== "shader") {
        return false;
      }

      const targets =
        entry.kind === "weaponOrnament" || entry.kind === "ornament"
          ? (entry.items ?? []).map((hash) => entryFor(hash)?.name ?? "")
          : [];
      const searched = [
        entry.name,
        setOf(entry) ?? "",
        entry.source ?? "",
        entry.kind === "weapon" ? entry.typeName : "",
        ...targets,
      ]
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

    if (picked === WEAPON) {
      return [];
    }

    return [
      ...new Set(
        LOOK_SLOTS.flatMap((slot) => {
          if (slot === picked) {
            return [];
          }

          const entry = entryFor(hashAt(slot, kind));
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

  const weaponShown = createMemo(() => {
    const piece = weapon();

    return [
      {
        slot: WEAPON,
        itemHash: piece.ornamentHash ?? piece.weaponHash,
        shaderHash: piece.shaderHash,
      },
    ];
  });

  createEffect(() => {
    const armor = mode() === "armor";
    const piece = weapon();
    const patch: Partial<Params> = {
      mode: mode(),
      class: armor ? (CLASSES[classType()] ?? "titan") : "titan",
      body: armor && female() ? "b" : "a",
      weapon: armor
        ? []
        : hashIds([piece.weaponHash, piece.ornamentHash, piece.shaderHash]),
    };

    for (const slot of LOOK_SLOTS) {
      const held = pieces()[slot];

      patch[SLOT_PARAMS[slot]] = armor
        ? hashIds([held.armorHash, held.ornamentHash, held.shaderHash])
        : [];
    }

    url.replace(patch);
  });

  const [name, setName] = createSignal("");
  const [removing, setRemoving] = createSignal<Look | undefined>(undefined);

  const save = async () => {
    const trimmed = name().trim() || "Untitled look";
    const saved = await writeLook({
      id: crypto.randomUUID(),
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

    setName("");
  };

  const open = (look: Look) => {
    setClassType(look.classType);
    setFemale(look.female);
    setPiecesByClass((all) => ({ ...all, [look.classType]: look.pieces }));
  };

  const remove = async (look: Look) => {
    setRemoving(undefined);

    const done = await writeLook({ ...look, removed: true });

    if (!done) {
      showToast("Look not removed", "danger");

      return;
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

  const Cell = (props: { slot: PickSlot; kind: PickKind }) => {
    const selected = () =>
      picking().slot === props.slot && picking().kind === props.kind;
    const pick = () => setPicking({ slot: props.slot, kind: props.kind });

    return (
      <Show
        when={shownIn(props.slot, props.kind)}
        fallback={
          <button
            type="button"
            aria-label={`${SLOT_LABELS[props.slot]} ${kindLabel(props.kind)}`}
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

  const busy = () => {
    if (items.error) {
      return false;
    }

    const statuses = Object.values(slotStatus());

    return (
      !items() ||
      statuses.length === 0 ||
      statuses.some((status) => status.kind === "loading") ||
      poseLoading()
    );
  };

  const heading = (): string => {
    const { slot, kind } = picking();

    if (slot === WEAPON) {
      return kind === "gear" ? "Weapons" : "Weapon shader";
    }

    return `${SLOT_LABELS[slot]} ${kindLabel(kind).toLowerCase()}`;
  };

  const SlotRow = (props: { slot: PickSlot }) => (
    <div class="grid grid-cols-[1fr_repeat(2,var(--tile))] items-center gap-1.5">
      <SlotLabel slot={props.slot} />
      <For each={PICK_KINDS}>
        {(kind) => <Cell slot={props.slot} kind={kind} />}
      </For>
    </div>
  );

  const SlotLabel = (props: { slot: PickSlot }) => {
    const failure = () => {
      const now = slotStatus()[props.slot];

      return now?.kind === "failed" ? now.message : undefined;
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
        <div class="flex items-center justify-between gap-2">
          <PickOne
            value={mode()}
            options={LOOK_MODES}
            label={(one) => MODE_LABELS[one]}
            onChange={setMode}
          />
          <Show when={mode() === "armor" && app.stores().length > 0}>
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
              Import Character
            </Button>
          </Show>
        </div>
        <Show
          when={mode() === "armor"}
          fallback={
            <div class="flex flex-col gap-1.5">
              <div class="grid grid-cols-[1fr_repeat(2,var(--tile))] gap-1.5">
                <span />
                <For each={PICK_KINDS}>
                  {(kind) => <span class={LABEL}>{kindLabel(kind)}</span>}
                </For>
              </div>
              <SlotRow slot={WEAPON} />
            </div>
          }
        >
          <div class="flex flex-col gap-1.5">
            <div class={SETTING_ROW}>
              <span class={SETTING_LABEL}>Class</span>
              <NativeSelect
                class="col-span-2 w-full"
                size="sm"
                aria-label="Class"
                value={CLASSES[classType()]}
                onChange={(event) =>
                  setClassType(
                    CLASSES.indexOf(event.currentTarget.value as ClassName),
                  )
                }
              >
                <For each={CLASSES}>
                  {(one) => <option value={one}>{CLASS_LABELS[one]}</option>}
                </For>
              </NativeSelect>
            </div>
            <div class="grid grid-cols-[1fr_repeat(2,var(--tile))] gap-1.5">
              <span />
              <For each={PICK_KINDS}>
                {(kind) => <span class={LABEL}>{kindLabel(kind)}</span>}
              </For>
            </div>
            <For each={LOOK_SLOTS}>{(slot) => <SlotRow slot={slot} />}</For>
            <div class={SETTING_ROW}>
              <span class={SETTING_LABEL}>Body</span>
              <PickOne
                size="sm"
                class="col-span-2 w-full *:flex-1"
                value={female() ? "b" : "a"}
                options={BODIES}
                label={(one) => one.toUpperCase()}
                onChange={(one) => setFemale(one === "b")}
              />
            </div>
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
                <Button size="sm" onClick={() => void save()}>
                  Save
                </Button>
              </div>
              <div class="flex flex-col">
                <For each={savedLooks()}>
                  {(look) => (
                    <div class="flex items-center gap-0.5">
                      <button
                        type="button"
                        class={`${ROW} flex-1`}
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
            <Show
              when={mode() === "armor"}
              fallback={
                <Viewer mode="weapons" pieces={weaponShown()} female={false} />
              }
            >
              <Viewer mode="armor" pieces={shown()} female={female()} />
            </Show>
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
            {heading()}
          </Heading>
          <Show when={mode() === "armor" && picking().kind === "shader"}>
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
