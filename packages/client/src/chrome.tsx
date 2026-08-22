import { createSignal, onCleanup, type JSX } from "solid-js";

export interface Chrome {
  tabs?: JSX.Element;
  tools?: JSX.Element;
  status?: JSX.Element;
}

const [held, setHeld] = createSignal<Chrome | undefined>(undefined);

export const chrome = held;

/** Hands a page's subtabs and tools to the app header instead of the scroll body */
export const PageChrome = (props: Chrome) => {
  setHeld(props);

  onCleanup(() => setHeld((was) => (was === props ? undefined : was)));

  return undefined;
};
