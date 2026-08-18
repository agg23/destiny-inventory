import { Button as Kobalte } from "@kobalte/core/button";
import { cva, type VariantProps } from "class-variance-authority";
import { splitProps, type ComponentProps } from "solid-js";

import { cn } from "./cn.ts";

// One --accent drives the fill, the ring and the hover ring. Shared with SplitButton, which
// puts the outline on the pair so the two halves read as a single control
export const ACCENT = {
  default: "[--accent:var(--color-fg)] text-text",
  light: "[--accent:var(--color-light)] text-light",
  danger: "[--accent:var(--color-error)] text-error",
  ghost: "[--accent:var(--color-fg)] text-muted",
} as const;

export const FILL = "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]";

export const RING =
  "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_20%,transparent)]";

// The doubled outer ring on hover is the game's own control idiom
export const GLOW = cn(
  "after:pointer-events-none after:absolute after:-inset-0.5 after:scale-[1.02]",
  "after:shadow-[0_0_0_2px_transparent] after:transition after:duration-250",
  "hover:after:scale-100 hover:after:shadow-[0_0_0_2px_var(--accent)]",
);

export const buttonVariants = cva(
  cn(
    "relative inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap",
    "cursor-pointer font-medium tracking-base transition-colors duration-250",
    "enabled:hover:bg-[color-mix(in_srgb,var(--accent)_40%,transparent)]",
    "enabled:hover:text-fg",
    "disabled:cursor-default disabled:bg-[color-mix(in_srgb,var(--color-fg)_5%,transparent)]",
    "disabled:text-dim",
  ),
  {
    variants: {
      variant: ACCENT,
      // Off when something outside the button owns the outline, as in a split button
      ring: {
        on: cn(
          RING,
          "disabled:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-fg)_10%,transparent)]",
        ),
        off: "shadow-none",
      },
      glow: { on: GLOW, off: "" },
      fill: { on: FILL, off: "bg-transparent" },
      size: {
        sm: "h-6 px-2 text-sm",
        md: "h-8 px-3 text-md",
        lg: "h-10 px-4 text-lg",
        "icon-sm": "size-6 text-sm",
        "icon-md": "size-8 text-md",
        "icon-lg": "size-10 text-lg",
      },
    },
    compoundVariants: [
      { variant: "ghost", fill: "on", class: "bg-transparent" },
      { variant: "ghost", ring: "on", class: "shadow-none" },
    ],
    defaultVariants: {
      variant: "default",
      size: "md",
      ring: "on",
      glow: "on",
      fill: "on",
    },
  },
);

type Variants = VariantProps<typeof buttonVariants>;

export type ButtonProps = ComponentProps<"button"> & Variants;

export const Button = (props: ButtonProps) => {
  const [local, rest] = splitProps(props, [
    "class",
    "variant",
    "size",
    "ring",
    "glow",
    "fill",
  ]);

  return (
    <Kobalte
      class={cn(
        buttonVariants({
          variant: local.variant,
          size: local.size,
          ring: local.ring,
          glow: local.glow,
          fill: local.fill,
        }),
        local.class,
      )}
      {...rest}
    />
  );
};

// A label is not optional on a control whose content is a glyph
export type IconButtonProps = Omit<ButtonProps, "size"> & {
  label: string;
  size?: Extract<Variants["size"], `icon-${string}`>;
};

export const IconButton = (props: IconButtonProps) => {
  const [local, rest] = splitProps(props, ["label", "size"]);

  return (
    <Button aria-label={local.label} size={local.size ?? "icon-md"} {...rest} />
  );
};
