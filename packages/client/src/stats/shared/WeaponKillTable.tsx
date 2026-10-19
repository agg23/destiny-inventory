import type { DimItem } from "app/inventory/item-types";
import { For, Show } from "solid-js";

import { ItemTile } from "../../components/ItemTile.tsx";
import { Checkbox } from "../../components/lib/Checkbox.tsx";
import { TABLE_FRAME, TABLE_HEADER } from "../../components/lib/text.ts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/lib/zaidan/table.tsx";
import { NUMBER, NumCell } from "../../components/NumCell.tsx";
import { trackPreview } from "../../core/items/preview.ts";
import type { WeaponKills } from "./statData.ts";
import { DASH_ARRAY, type WeaponLine } from "./weaponLines.ts";

// Keeps its width without a line
const LineSample = (props: { line: WeaponLine | undefined }) => (
  <svg class="w-5 shrink-0" height="8" viewBox="0 0 20 8" aria-hidden="true">
    <Show when={props.line}>
      {(line) => (
        <line
          x1="0"
          y1="4"
          x2="20"
          y2="4"
          stroke={line().color}
          stroke-width="2"
          stroke-dasharray={DASH_ARRAY[line().dash]}
        />
      )}
    </Show>
  </svg>
);

export const WeaponKillTable = (props: {
  weapons: WeaponKills[];
  itemOf: (weapon: WeaponKills) => DimItem | undefined;
  nameOf: (hash: number) => string;
  isPicked?: (weapon: WeaponKills) => boolean;
  lineOf?: (weapon: WeaponKills) => WeaponLine | undefined;
  onPick?: (weapon: WeaponKills) => void;
  onOpen?: (weapon: WeaponKills) => void;
}) => (
  <div class={TABLE_FRAME}>
    <Table>
      <TableHeader class={TABLE_HEADER}>
        <TableRow>
          <Show when={props.onPick}>
            <TableHead class="w-8" />
          </Show>
          <TableHead>Weapon</TableHead>
          <TableHead class={NUMBER}>PvE</TableHead>
          <TableHead class={NUMBER}>PvP</TableHead>
          <TableHead class={NUMBER}>Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <For each={props.weapons}>
          {(weapon) => {
            const item = () => props.itemOf(weapon);

            return (
              <TableRow
                {...trackPreview(item, { rollWarning: true })}
                classList={{ "cursor-pointer": !!props.onOpen }}
                onClick={() => props.onOpen?.(weapon)}
              >
                <Show when={props.onPick}>
                  {(pick) => (
                    <TableCell>
                      <Checkbox
                        checked={props.isPicked?.(weapon) ?? true}
                        onChange={() => pick()(weapon)}
                      >
                        <span class="sr-only">
                          {props.nameOf(weapon.itemHash)}
                        </span>
                      </Checkbox>
                    </TableCell>
                  )}
                </Show>
                <TableCell>
                  <span class="inline-flex items-center gap-2">
                    <Show when={props.lineOf}>
                      {(lineOf) => <LineSample line={lineOf()(weapon)} />}
                    </Show>
                    <span class="size-8 shrink-0">
                      <Show when={item()}>
                        {(found) => (
                          <ItemTile
                            item={found()}
                            class="nested size-8"
                            badges={false}
                          />
                        )}
                      </Show>
                    </span>
                    {props.nameOf(weapon.itemHash)}
                  </span>
                </TableCell>
                <NumCell>{weapon.pve.toLocaleString()}</NumCell>
                <NumCell>{weapon.pvp.toLocaleString()}</NumCell>
                <NumCell class="font-medium">
                  {(weapon.pve + weapon.pvp).toLocaleString()}
                </NumCell>
              </TableRow>
            );
          }}
        </For>
      </TableBody>
    </Table>
  </div>
);
