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

export const Heart = (props: { class?: string; filled?: boolean }) => (
  <Icon class={props.class}>
    <path
      d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
      fill={props.filled ? "currentColor" : "none"}
    />
  </Icon>
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

export const ThumbsDown = (props: { class?: string }) => (
  <Icon class={props.class}>
    <path d="M17 14V2" />
    <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
  </Icon>
);

export const ThumbsUp = (props: { class?: string }) => (
  <Icon class={props.class}>
    <path d="M7 10v12" />
    <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
  </Icon>
);

export const X = (props: { class?: string }) => (
  <Icon class={props.class}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Icon>
);
