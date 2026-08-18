import { createSignal, For, onCleanup, Show } from "solid-js";

export interface Choice {
  id: string;
  label: string;
  onChoose: () => void;
}

interface Props {
  label: string;
  disabled: boolean;
  onPrimary: () => void;
  choices: Choice[];
}

/**
 * A default action plus the alternatives behind a caret. Picking from the list performs the
 * action rather than only selecting a target, so the alternatives cost one click, not two.
 */
export const SplitButton = (props: Props) => {
  const [open, setOpen] = createSignal(false);
  let root: HTMLDivElement | undefined = undefined;

  const onPointerDown = (e: PointerEvent) => {
    if (root && !root.contains(e.target as Node)) {
      setOpen(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKeyDown);

  onCleanup(() => {
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("keydown", onKeyDown);
  });

  const choose = (choice: Choice) => {
    setOpen(false);
    choice.onChoose();
  };

  return (
    <div class="split" ref={(el) => (root = el)}>
      <div class="split-row">
        <button
          type="button"
          class="split-main"
          disabled={props.disabled}
          onClick={props.onPrimary}
        >
          {props.label}
        </button>
        <Show when={props.choices.length > 0}>
          <button
            type="button"
            class="split-more"
            disabled={props.disabled}
            aria-label={`${props.label}: other targets`}
            aria-expanded={open()}
            aria-haspopup="menu"
            onClick={() => setOpen(!open())}
          >
            <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
              <path d="M0 0h10L5 6z" fill="currentColor" />
            </svg>
          </button>
        </Show>
      </div>
      <Show when={open()}>
        <div class="split-menu" role="menu">
          <For each={props.choices}>
            {(choice) => (
              <button type="button" role="menuitem" onClick={() => choose(choice)}>
                {choice.label}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
