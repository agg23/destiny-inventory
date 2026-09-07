import { For, Show } from "solid-js";

import { readable } from "../activities.ts";
import { BUNGIE } from "../bungie.ts";
import type { Claimed, Order } from "../orders.ts";
import { remaining } from "../reset.ts";
import { day, exact } from "./todoFormat.ts";

// The framework only ships an accent stripe for the two rarities that get one in game
const ACCENTS: Record<string, string> = {
  Legendary: "accent-legendary",
  Exotic: "accent-exotic",
};

const HOUR = 3_600_000;

const percent = (order: Order): number =>
  order.goal === 0 ? 0 : Math.min(100, (order.progress / order.goal) * 100);

export const OrderCard = (props: {
  order: Order;
  now: number;
  values: Record<number, number>;
}) => (
  <div
    class={`card order-row ${ACCENTS[props.order.rarity] ?? ""}`}
    data-rarity={props.order.rarity}
  >
    <div class="order-head">
      <img
        class="glyph"
        src={`${BUNGIE}${props.order.icon}`}
        alt={props.order.family}
      />
      <span class="order-name">{props.order.name}</span>
      <Show
        when={props.order.expiresAt !== undefined}
        fallback={<span class="text-muted">No deadline</span>}
      >
        <span
          class="whitespace-nowrap tabular-nums"
          classList={{
            "text-warning": (props.order.expiresAt ?? 0) - props.now < HOUR,
          }}
          title={`Expires ${exact(props.order.expiresAt ?? 0)}`}
        >
          {remaining((props.order.expiresAt ?? 0) - props.now)}
        </span>
      </Show>
    </div>
    <div class="order-tier">
      <span class={`order-rarity text-${props.order.rarity.toLowerCase()}`}>
        {props.order.rarity}
      </span>
      <span class="text-muted">{props.order.family}</span>
    </div>
    <Show when={props.order.description}>
      <p class="order-note m-0 text-muted">
        {readable(props.order.description, props.values)}
      </p>
    </Show>
    <div class="progress objective">
      <span
        class="progress-fill"
        style={{ width: `${percent(props.order)}%` }}
      />
    </div>
    <Show when={props.order.readout}>
      <div class="order-foot text-muted">
        <span
          class="tabular-nums"
          title={`${props.order.progress.toLocaleString()} / ${props.order.goal.toLocaleString()} points`}
        >
          {props.order.readout}
        </span>
      </div>
    </Show>
  </div>
);

export const ClaimedLog = (props: { log: Claimed[] }) => (
  <section class="todo-section">
    <h2 class="section-label">Completed orders</h2>
    <Show
      when={props.log.length > 0}
      fallback={
        <p class="m-0 text-muted">Nothing claimed while the app was open</p>
      }
    >
      <table class="table">
        <tbody>
          <For each={props.log}>
            {(entry) => (
              <tr>
                <td>{entry.name}</td>
                <td class="text-muted">{entry.family}</td>
                <td class="num" title={`Claimed ${exact(entry.claimedAt)}`}>
                  {day(entry.claimedAt)}
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </Show>
  </section>
);
