const NAME = "--hovered";

let held: HTMLElement | undefined = undefined;
let leave: (() => void) | undefined = undefined;

let pointerX = 0;
let pointerY = 0;

const track = (event: MouseEvent) => {
  pointerX = event.clientX;
  pointerY = event.clientY;
};

// Firefox withholds mouseleave until a scroll settles, so re-test the pointer here
const recheck = () => {
  if (!held) {
    return;
  }

  const under = document.elementFromPoint(pointerX, pointerY);

  if (!under || !held.contains(under)) {
    leave?.();
  }
};

/** Moves the CSS anchor name to this element, calling onLeave once the pointer is off it */
export const holdAnchor = (element: HTMLElement, onLeave: () => void) => {
  leave = onLeave;

  if (held === element) {
    return;
  }

  held?.style.removeProperty("anchor-name");
  element.style.setProperty("anchor-name", NAME);
  held = element;
};

export const releaseAnchor = () => {
  held?.style.removeProperty("anchor-name");
  held = undefined;
  leave = undefined;
};

const init = () => {
  document.addEventListener("mousemove", track, { passive: true });
  document.addEventListener("scroll", recheck, {
    capture: true,
    passive: true,
  });
};

init();
