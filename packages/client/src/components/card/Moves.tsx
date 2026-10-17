import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { Show } from "solid-js";

import { useApp } from "../../core/app/state.ts";
import { guest } from "../../core/profile/guest.ts";
import {
  defaultEquip,
  defaultTransfer,
  equipTargets,
  pullBlocked,
  storeLabel,
  transferBlocked,
  transferTargets,
} from "../../core/profile/moveTargets.ts";
import { SplitButton, type Choice } from "../lib/SplitButton.tsx";

export const Moves = (props: { item: DimItem; compact?: boolean }) => {
  const app = useApp();

  const transfers = () =>
    transferTargets(props.item, app.stores(), app.active());
  const equips = () => equipTargets(props.item, app.stores(), app.active());

  const transferTo = () =>
    defaultTransfer(props.item, app.stores(), app.active());
  const equipOn = () => defaultEquip(props.item, app.stores(), app.active());

  const blocked = (target: DimStore) =>
    transferBlocked(props.item, app.stores(), target);

  const act = (target: DimStore, equip: boolean, manual: boolean) => {
    if (manual && !target.isVault) {
      app.onCharacter(target);
    }

    app.onMove(props.item, target, equip);
  };

  const choices = (targets: DimStore[], equip: boolean): Choice[] =>
    targets.map((store) => ({
      id: store.id,
      label: storeLabel(store),
      reason: equip ? pullBlocked(props.item) : blocked(store),
      onChoose: () => act(store, equip, true),
    }));

  return (
    <Show when={!guest()}>
      <div class="flex flex-col items-stretch gap-2">
        <Show when={transferTo()}>
          {(target) => (
            <SplitButton
              block
              size="sm"
              label={
                props.compact
                  ? "Transfer"
                  : `Transfer to ${storeLabel(target())}`
              }
              disabled={!!app.moving() || !!blocked(target())}
              title={blocked(target())}
              onPrimary={() => act(target(), false, false)}
              choices={choices(transfers(), false)}
            />
          )}
        </Show>
        <Show when={equipOn()}>
          {(target) => (
            <SplitButton
              block
              size="sm"
              label={
                props.compact ? "Equip" : `Equip on ${storeLabel(target())}`
              }
              disabled={!!app.moving() || !!pullBlocked(props.item)}
              title={pullBlocked(props.item)}
              onPrimary={() => act(target(), true, false)}
              choices={choices(equips(), true)}
            />
          )}
        </Show>
        <Show when={app.moving()}>
          {(status) => <p class="text-xs text-muted-foreground">{status()}</p>}
        </Show>
      </div>
    </Show>
  );
};
