import type { JSX } from "solid-js";

// Lucide's paths (ISC)
const Icon = (props: { class?: string; children: JSX.Element }) => (
  <svg
    class={props.class}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {props.children}
  </svg>
);

export const Check = (props: { class?: string }) => (
  <Icon class={props.class}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

export const ChevronDown = (props: { class?: string }) => (
  <Icon class={props.class}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const ChevronRight = (props: { class?: string }) => (
  <Icon class={props.class}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
);

export const X = (props: { class?: string }) => (
  <Icon class={props.class}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Icon>
);
