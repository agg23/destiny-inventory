import { createSignal, onCleanup } from "solid-js";

const SECOND = 1000;

const [now, setNow] = createSignal(Date.now());

let watching = 0;
let ticker: number | undefined = undefined;

const tick = () => setNow(Date.now());

/**
 * Ticks every second
 */
export const useClock = (): (() => number) => {
  watching += 1;

  if (ticker === undefined) {
    ticker = window.setInterval(tick, SECOND);
    document.addEventListener("visibilitychange", tick);
  }

  onCleanup(() => {
    watching -= 1;

    if (watching === 0) {
      window.clearInterval(ticker);
      document.removeEventListener("visibilitychange", tick);
      ticker = undefined;
    }
  });

  tick();

  return now;
};
