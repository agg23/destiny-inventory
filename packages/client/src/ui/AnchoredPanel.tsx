import { createSignal, onCleanup, onMount, type JSX } from "solid-js";

const GAP = 8;

// The framework's own tooltip and card width
const WIDTH = 352;

/** Fixed-position panel beside an anchor rect, shifted up when it would overflow */
export const AnchoredPanel = (props: {
  anchor: DOMRect;
  class: string;
  children: JSX.Element;
}) => {
  const [height, setHeight] = createSignal(0);

  let panel: HTMLElement | undefined = undefined;

  onMount(() => {
    if (!panel) {
      return;
    }

    const observer = new ResizeObserver(() =>
      setHeight(panel?.offsetHeight ?? 0),
    );
    observer.observe(panel);

    onCleanup(() => observer.disconnect());
  });

  const position = () => {
    const room = window.innerWidth - props.anchor.right;
    const left =
      room > WIDTH + GAP
        ? props.anchor.right + GAP
        : props.anchor.left - WIDTH - GAP;

    return {
      left: `${Math.max(GAP, left)}px`,
      top: `${Math.max(
        GAP,
        Math.min(props.anchor.top, window.innerHeight - height() - GAP),
      )}px`,
      width: `${WIDTH}px`,
    };
  };

  return (
    <aside class={props.class} ref={(el) => (panel = el)} style={position()}>
      {props.children}
    </aside>
  );
};
