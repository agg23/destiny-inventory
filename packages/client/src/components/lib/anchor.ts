const DEFAULT = "--hovered";

interface Hold {
  element: HTMLElement;
  leave: () => void;
}

const held = new Map<string, Hold>();

let pointerX = 0;
let pointerY = 0;

const track = (event: MouseEvent) => {
  pointerX = event.clientX;
  pointerY = event.clientY;
};

// Firefox withholds mouseleave until a scroll settles, so re-test the pointer here
const recheck = () => {
  const under = document.elementFromPoint(pointerX, pointerY);

  for (const hold of [...held.values()]) {
    if (!under || !hold.element.contains(under)) {
      hold.leave();
    }
  }
};

/** Moves the named CSS anchor to this element, calling onLeave once the pointer is off it */
export const holdAnchor = (
  element: HTMLElement,
  onLeave: () => void,
  name: string = DEFAULT,
) => {
  const existing = held.get(name);

  if (existing?.element === element) {
    existing.leave = onLeave;

    return;
  }

  existing?.element.style.removeProperty("anchor-name");
  element.style.setProperty("anchor-name", name);
  held.set(name, { element, leave: onLeave });
};

export const releaseAnchor = (name: string = DEFAULT) => {
  held.get(name)?.element.style.removeProperty("anchor-name");
  held.delete(name);
};

const init = () => {
  document.addEventListener("mousemove", track, { passive: true });
  document.addEventListener("scroll", recheck, {
    capture: true,
    passive: true,
  });
};

init();
