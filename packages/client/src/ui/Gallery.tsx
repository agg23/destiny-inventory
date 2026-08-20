import { For } from "solid-js";

import { Button, IconButton } from "./Button.tsx";
import { SplitButton } from "./SplitButton.tsx";
import { cn } from "./cn.ts";

const VARIANTS = ["default", "light", "danger", "ghost"] as const;
const SIZES = ["sm", "md", "lg"] as const;
const ICON_SIZES = ["icon-sm", "icon-md", "icon-lg"] as const;

// Tailwind only sees class names that appear whole
const TYPE_SIZES = [
  ["2xl", "text-2xl"],
  ["xl", "text-xl"],
  ["lg", "text-lg"],
  ["md", "text-md"],
  ["sm", "text-sm"],
  ["xs", "text-xs"],
] as const;

const CHOICES = [
  { id: "titan", label: "Titan", onChoose: () => undefined },
  { id: "hunter", label: "Hunter", onChoose: () => undefined },
  { id: "vault", label: "Vault", onChoose: () => undefined },
];

const COLORS = [
  ["fg", "bg-fg"],
  ["text", "bg-text"],
  ["muted", "bg-muted"],
  ["dim", "bg-dim"],
  ["line", "bg-line"],
  ["line-bright", "bg-line-bright"],
  ["panel", "bg-panel"],
  ["panel-raised", "bg-panel-raised"],
  ["light", "bg-light"],
  ["cream", "bg-cream"],
  ["error", "bg-error"],
  ["warning", "bg-warning"],
  ["good", "bg-good"],
  ["exotic", "bg-exotic"],
  ["legendary", "bg-legendary"],
  ["rare", "bg-rare"],
  ["uncommon", "bg-uncommon"],
  ["common", "bg-common"],
  ["kinetic", "bg-kinetic"],
  ["solar", "bg-solar"],
  ["arc", "bg-arc"],
  ["void", "bg-void"],
  ["stasis", "bg-stasis"],
  ["strand", "bg-strand"],
] as const;

const RARITIES = ["common", "uncommon", "rare", "legendary", "exotic"] as const;

const STATS = [
  ["Impact", 84],
  ["Range", 46],
  ["Stability", 55],
] as const;

const Section = (props: { title: string; children: unknown }) => (
  <section class="border-t border-line pt-4">
    <h2 class="mb-4 text-sm font-medium uppercase tracking-caps text-muted">
      {props.title}
    </h2>
    {props.children as never}
  </section>
);

export const Gallery = () => (
  <main class="mx-auto flex max-w-4xl flex-col gap-6 p-6 text-text">
    <header>
      <h1 class="text-2xl">Components</h1>
    </header>

    <Section title="Button">
      <div class="flex flex-col gap-4">
        <For each={VARIANTS}>
          {(variant) => (
            <div class="flex flex-wrap items-center gap-4">
              <div class="w-16 text-sm text-dim">{variant}</div>
              <For each={SIZES}>
                {(size) => (
                  <Button variant={variant} size={size}>
                    Equip
                  </Button>
                )}
              </For>
              <Button variant={variant} disabled>
                Disabled
              </Button>
            </div>
          )}
        </For>
      </div>
    </Section>

    <Section title="Icon button">
      <div class="flex flex-wrap items-center gap-4">
        <For each={ICON_SIZES}>
          {(size) => (
            <For each={VARIANTS}>
              {(variant) => (
                <IconButton label="Unpin" size={size} variant={variant}>
                  ×
                </IconButton>
              )}
            </For>
          )}
        </For>
      </div>
    </Section>

    <Section title="Spacing scale">
      <div class="flex items-end gap-4">
        <For each={[0.5, 1, 1.5, 2, 3, 4, 6, 8]}>
          {(step) => (
            <div class="flex flex-col items-center gap-1">
              <div
                class="bg-light"
                style={{ width: `${step * 4}px`, height: "24px" }}
              />
              <div class="text-xs text-dim">{step}</div>
              <div class="text-xs text-dim">{step * 4}px</div>
            </div>
          )}
        </For>
      </div>
    </Section>

    <Section title="Color">
      <div class="flex flex-wrap gap-3">
        <For each={COLORS}>
          {([name, cls]) => (
            <div class="flex flex-col items-center gap-1">
              <div
                class={cn(
                  cls,
                  "size-10 shadow-[inset_0_0_0_1px_var(--color-line-bright)]",
                )}
              />
              <div class="text-xs text-dim">{name}</div>
            </div>
          )}
        </For>
      </div>
    </Section>

    <Section title="Split button">
      <div class="flex flex-col gap-4">
        <For each={VARIANTS}>
          {(variant) => (
            <div class="flex flex-wrap items-center gap-4">
              <div class="w-16 text-sm text-dim">{variant}</div>
              <For each={SIZES}>
                {(size) => (
                  <SplitButton
                    label="Equip"
                    variant={variant}
                    size={size}
                    onPrimary={() => undefined}
                    choices={CHOICES}
                  />
                )}
              </For>
              <SplitButton
                label="No targets"
                variant={variant}
                onPrimary={() => undefined}
                choices={[]}
              />
              <SplitButton
                label="Equip"
                variant={variant}
                disabled
                onPrimary={() => undefined}
                choices={CHOICES}
              />
            </div>
          )}
        </For>
      </div>
    </Section>

    <Section title="Type">
      <div class="flex flex-col gap-2">
        <For each={TYPE_SIZES}>
          {([name, cls]) => (
            <div class="flex items-baseline gap-4">
              <div class="w-10 text-xs text-dim">{name}</div>
              <div class={cn(cls, "tracking-base")}>Ouster Engine</div>
            </div>
          )}
        </For>
        <div class="flex items-baseline gap-4">
          <div class="w-10 text-xs text-dim">label</div>
          <div class="text-sm font-medium uppercase tracking-caps text-muted">
            Kinetic weapons
          </div>
        </div>
      </div>
    </Section>

    <Section title="Item tile">
      <div class="flex flex-wrap items-center gap-4">
        <For each={RARITIES}>
          {(rarity) => (
            <button
              type="button"
              class={cn("item-tile small", rarity)}
              aria-label={rarity}
            />
          )}
        </For>
        <button
          type="button"
          class="item-tile small exotic masterwork"
          aria-label="exotic masterwork"
        />
      </div>
    </Section>

    <Section title="Item tooltip">
      <div class="item-tooltip">
        <div class="tooltip-header exotic">
          <div class="tooltip-name">Gjallarhorn</div>
          <div class="tooltip-type">
            <span>Rocket launcher</span>
            <span>Exotic</span>
          </div>
        </div>
        <div class="tooltip-body">
          <div class="tooltip-power">
            <span class="power-value">1810</span>
            <span class="power-type">Solar · Heavy</span>
          </div>
        </div>
        <div class="tooltip-body">
          <div class="tooltip-perk">
            <span class="perk-icon" />
            <div class="perk-text">
              <b>Wolfpack Rounds</b>
              <span>Rounds split into tracking cluster missiles.</span>
            </div>
          </div>
        </div>
      </div>
    </Section>

    <Section title="Stat bars">
      <div class="stat-list max-w-90">
        <For each={STATS}>
          {([name, value]) => (
            <>
              <span class="stat-name">{name}</span>
              <span class="stat-bar">
                <span class="stat-fill" style={{ width: `${value}%` }} />
              </span>
              <span class="stat-value">{value}</span>
            </>
          )}
        </For>
      </div>
    </Section>
  </main>
);
