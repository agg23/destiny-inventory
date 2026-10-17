import { onCleanup, onMount, type JSX } from "solid-js";

export const Header = (props: { children: JSX.Element }) => {
  let head: HTMLElement | undefined = undefined;

  // The guest banner changes the header's height
  onMount(() => {
    if (!head) {
      return;
    }

    const measure = () =>
      document.documentElement.style.setProperty(
        "--header-h",
        `${head?.offsetHeight ?? 0}px`,
      );

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(head);

    onCleanup(() => observer.disconnect());
  });

  return (
    <header
      class="sticky top-0 z-5 border-b bg-background"
      ref={(el) => (head = el)}
    >
      {props.children}
    </header>
  );
};
