import { Button as Kobalte } from "@kobalte/core/button";
import { cva, type VariantProps } from "class-variance-authority";
import { splitProps, type ComponentProps } from "solid-js";

import { cn } from "./cn.ts";

// destiny-ui-css variant classes
export const VARIANT = {
  default: "",
  light: "gold",
  danger: "danger",
  ghost: "ghost",
} as const;

export const buttonVariants = cva(
  "button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
  {
    variants: {
      variant: VARIANT,
      place: { relative: "relative", absolute: "absolute" },
      size: {
        // The framework stops at .small
        xs: "small px-3 text-sm tracking-caps",
        sm: "small",
        md: "",
        lg: "large",
        "icon-xs": "small px-0 text-sm tracking-caps min-w-(--button-xs)",
        "icon-sm": "small px-0 min-w-(--button-sm)",
        "icon-md": "px-0 min-w-(--button-md)",
        "icon-lg": "large px-0 min-w-(--button-lg)",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      place: "relative",
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
    "place",
  ]);

  return (
    <Kobalte
      class={cn(
        buttonVariants({
          variant: local.variant,
          size: local.size,
          place: local.place,
        }),
        local.class,
      )}
      {...rest}
    />
  );
};

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
