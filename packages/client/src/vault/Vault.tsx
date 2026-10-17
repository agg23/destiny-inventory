import { Show } from "solid-js";

import { Rail } from "../components/rail/Rail.tsx";
import { useApp } from "../core/app/state.ts";
import { Inventory } from "./shared/Inventory.tsx";

export const Vault = () => {
  const app = useApp();

  return (
    <>
      <Show when={app.loaded()}>
        <Inventory />
      </Show>

      <Rail />
    </>
  );
};
