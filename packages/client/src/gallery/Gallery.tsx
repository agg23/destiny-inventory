import { createSignal, For, type JSX } from "solid-js";

import { Checkbox } from "../components/lib/Checkbox.tsx";
import { cn } from "../components/lib/cn.ts";
import { PickOne } from "../components/lib/PickOne.tsx";
import { Objective, Progress } from "../components/lib/Progress.tsx";
import { SearchField } from "../components/lib/SearchField.tsx";
import { Select } from "../components/lib/Select.tsx";
import { Slider } from "../components/lib/Slider.tsx";
import { SplitButton } from "../components/lib/SplitButton.tsx";
import {
  CARD,
  HEADING,
  HEADING_NOTE,
  LABEL,
  ROW,
  SPENT,
  TABLE_FRAME,
  TABLE_HEADER,
} from "../components/lib/text.ts";
import { Toggle } from "../components/lib/Toggle.tsx";
import { Badge } from "../components/lib/zaidan/badge.tsx";
import { Button } from "../components/lib/zaidan/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/lib/zaidan/dropdown-menu.tsx";
import { ChevronDown } from "../components/lib/zaidan/icons.tsx";
import { Input } from "../components/lib/zaidan/input.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/lib/zaidan/popover.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/lib/zaidan/table.tsx";
import { Textarea } from "../components/lib/zaidan/textarea.tsx";

const VARIANTS = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const;

const SIZES = ["xs", "sm", "default", "lg"] as const;

// Tailwind only sees class names that appear whole
const TYPE_SIZES = [
  ["2xl", "text-2xl"],
  ["xl", "text-xl"],
  ["lg", "text-lg"],
  ["base", "text-base"],
  ["sm", "text-sm"],
  ["xs", "text-xs"],
] as const;

const CHOICES = [
  { id: "titan", label: "Titan", onChoose: () => undefined },
  { id: "hunter", label: "Hunter", onChoose: () => undefined },
  {
    id: "vault",
    label: "Vault",
    reason: "Vault is full",
    onChoose: () => undefined,
  },
];

const COLORS = [
  ["background", "bg-background"],
  ["card", "bg-card"],
  ["popover", "bg-popover"],
  ["muted", "bg-muted"],
  ["border", "bg-border"],
  ["input", "bg-input"],
  ["foreground", "bg-foreground"],
  ["muted-foreground", "bg-muted-foreground"],
  ["destructive", "bg-destructive"],
  ["light", "bg-light"],
  ["cream", "bg-cream"],
  ["warning", "bg-warning"],
  ["good", "bg-good"],
  ["pve", "bg-pve"],
  ["pvp", "bg-pvp"],
] as const;

const TEXT_COLORS = [
  ["exotic", "text-exotic"],
  ["legendary", "text-legendary"],
  ["rare", "text-rare"],
  ["uncommon", "text-uncommon"],
  ["common", "text-common"],
  ["kinetic", "text-kinetic"],
  ["arc", "text-arc"],
  ["solar", "text-solar"],
  ["void", "text-void"],
  ["stasis", "text-stasis"],
  ["strand", "text-strand"],
] as const;

const RARITIES = ["common", "uncommon", "rare", "legendary", "exotic"];

const REALMS = [
  "Vanguard",
  "Crucible",
  "Gambit",
  "Raids and dungeons",
] as const;

const SORTS = ["power", "name"] as const;

const SORT_NAMES = { power: "Power", name: "Name" };

const Section = (props: { title: string; children: JSX.Element }) => (
  <section class="flex flex-col gap-3 border-t pt-4">
    <h2 class={HEADING}>{props.title}</h2>
    {props.children}
  </section>
);

const Row = (props: { label: string; children: JSX.Element }) => (
  <div class="flex flex-wrap items-center gap-3">
    <div class="w-24 text-xs text-muted-foreground">{props.label}</div>
    {props.children}
  </div>
);

/** Every shared component in every state, outside the app */
export const Gallery = () => {
  const [realm, setRealm] = createSignal<(typeof REALMS)[number]>("Vanguard");
  const [sort, setSort] = createSignal<(typeof SORTS)[number]>("power");
  const [checked, setChecked] = createSignal(true);
  const [on, setOn] = createSignal(false);
  const [size, setSize] = createSignal(48);
  const [query, setQuery] = createSignal("is:weapon");

  return (
    <main class="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header>
        <h1 class="text-2xl font-semibold">Components</h1>
      </header>

      <Section title="Button">
        <For each={VARIANTS}>
          {(variant) => (
            <Row label={variant}>
              <For each={SIZES}>
                {(one) => (
                  <Button variant={variant} size={one}>
                    Equip
                  </Button>
                )}
              </For>
              <Button variant={variant} disabled>
                Disabled
              </Button>
              <Button variant={variant} size="icon" aria-label="Open">
                <ChevronDown />
              </Button>
            </Row>
          )}
        </For>
      </Section>

      <Section title="Split button">
        <Row label="outline">
          <SplitButton
            label="Transfer"
            size="sm"
            onPrimary={() => undefined}
            choices={CHOICES}
          />
          <SplitButton
            label="Transfer"
            onPrimary={() => undefined}
            choices={CHOICES}
          />
          <SplitButton
            label="No targets"
            onPrimary={() => undefined}
            choices={[]}
          />
          <SplitButton
            label="Transfer"
            disabled
            title="Moving"
            onPrimary={() => undefined}
            choices={CHOICES}
          />
        </Row>
      </Section>

      <Section title="Filter row">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <PickOne
            value={realm()}
            options={REALMS}
            label={(one) => one}
            disabled={(one) => (one === "Gambit" ? "Not this week" : undefined)}
            onChange={setRealm}
          />
          <Select
            label="Sort"
            value={sort()}
            options={SORTS}
            names={SORT_NAMES}
            onChange={setSort}
          />
          <Checkbox checked={checked()} onChange={setChecked}>
            Show tagged
          </Checkbox>
          <Checkbox checked={false} disabled onChange={() => undefined}>
            Disabled
          </Checkbox>
          <span class="ml-auto text-muted-foreground tabular-nums">
            12 of 340 items
          </span>
        </div>
      </Section>

      <Section title="Fields">
        <div class="grid max-w-md gap-3">
          <SearchField
            placeholder="Filter items"
            value={query()}
            trailing="12 of 340"
            onInput={(e) => setQuery(e.currentTarget.value)}
            onClear={() => setQuery("")}
          />
          <Input placeholder="Bungie name" />
          <Input placeholder="Disabled" disabled />
          <Textarea placeholder="Add a note" />
        </div>
      </Section>

      <Section title="Settings controls">
        <div class="flex w-80 flex-col gap-4">
          <Slider
            label="Vault icon size"
            value={size()}
            min={32}
            max={64}
            format={(value) => `${value}px`}
            modified={size() !== 48}
            onReset={() => setSize(48)}
            onChange={setSize}
          />
          <Toggle label="Display expansions" checked={on()} onChange={setOn} />
        </div>
      </Section>

      <Section title="Menus">
        <Row label="dropdown">
          <DropdownMenu>
            <DropdownMenuTrigger as={Button} variant="outline">
              Tag
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Favorite</DropdownMenuItem>
              <DropdownMenuItem>Keep</DropdownMenuItem>
              <DropdownMenuItem disabled>Junk</DropdownMenuItem>
              <DropdownMenuItem variant="destructive">
                Clear tag
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Popover placement="bottom-start">
            <PopoverTrigger as={Button} variant="outline">
              Popover
            </PopoverTrigger>
            <PopoverContent class="w-80 gap-4 p-4">
              <p>A popover holds a small form</p>
              <Button size="sm" class="self-end">
                Save
              </Button>
            </PopoverContent>
          </Popover>
        </Row>
      </Section>

      <Section title="Badge">
        <Row label="variants">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="outline" class="border-light/40 text-light">
            Enhanced
          </Badge>
          <Badge variant="destructive">Destructive</Badge>
        </Row>
      </Section>

      <Section title="Progress">
        <div class="flex max-w-sm flex-col gap-3">
          <Progress value={0.4} />
          <Objective label="Defeat combatants" progress={34} goal={50} />
          <Objective label="Complete strikes" progress={3} goal={3} />
        </div>
      </Section>

      <Section title="Card and list">
        <div class="grid grid-cols-2 gap-3">
          <div class={CARD}>
            <span class="font-medium">Weekly challenge</span>
            <p class="text-xs text-muted-foreground">
              Complete Vanguard Ops playlist activities
            </p>
            <Progress value={0.6} />
          </div>
          <ul class="flex flex-col">
            <li>
              <button type="button" class={ROW}>
                <span class="flex-1">All</span>
                <span class="text-xs text-muted-foreground">340</span>
              </button>
            </li>
            <li>
              <button type="button" class={cn(ROW, "bg-muted")}>
                <span class="flex-1">Picked</span>
                <span class="text-xs text-muted-foreground">12</span>
              </button>
            </li>
          </ul>
        </div>
      </Section>

      <Section title="Table">
        <div class={TABLE_FRAME}>
          <Table>
            <TableHeader class={TABLE_HEADER}>
              <TableRow>
                <TableHead>Activity</TableHead>
                <TableHead class="text-right">Runs</TableHead>
                <TableHead>Rewards</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow class="bg-muted/30 hover:bg-muted/30">
                <TableCell colSpan={3} class="py-1.5">
                  <span class="flex items-baseline gap-2 text-xs">
                    <span class="font-medium">Featured</span>
                    <span class="text-muted-foreground">2</span>
                  </span>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>The Coil</TableCell>
                <TableCell class="text-right tabular-nums">14</TableCell>
                <TableCell>Wild Style</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Grasp of Avarice</TableCell>
                <TableCell class="text-right tabular-nums">3</TableCell>
                <TableCell class={SPENT}>Gjallarhorn catalyst</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section title="Type">
        <For each={TYPE_SIZES}>
          {([name, cls]) => (
            <Row label={name}>
              <div class={cls}>Ouster Engine</div>
            </Row>
          )}
        </For>
        <Row label="heading">
          <h3 class={`${HEADING} flex items-baseline gap-2`}>
            Daily challenges
            <span class={HEADING_NOTE}>4h left</span>
          </h3>
        </Row>
        <Row label="label">
          <span class={LABEL}>Kinetic weapons</span>
        </Row>
      </Section>

      <Section title="Color">
        <div class="flex flex-wrap gap-3">
          <For each={COLORS}>
            {([name, cls]) => (
              <div class="flex w-20 flex-col items-center gap-1">
                <div class={cn(cls, "size-10 rounded-md ring-1 ring-input")} />
                <div class="text-center text-xs text-muted-foreground">
                  {name}
                </div>
              </div>
            )}
          </For>
        </div>
        <div class="flex flex-wrap gap-4">
          <For each={TEXT_COLORS}>
            {([name, cls]) => <span class={cls}>{name}</span>}
          </For>
        </div>
      </Section>

      <Section title="Item tile and header">
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
        </div>
        <div class="item-tooltip">
          <div class="tooltip-header exotic">
            <div class="tooltip-name">Gjallarhorn</div>
            <div class="tooltip-type">
              <span>Rocket launcher</span>
            </div>
          </div>
          <div class="tooltip-body">
            <div class="tooltip-power">
              <span class="power-facts">
                <span class="power-value">1810</span>
                <span class="power-type">Solar</span>
              </span>
            </div>
          </div>
        </div>
      </Section>
    </main>
  );
};
