import { Button as Kobalte } from "@kobalte/core/button";
import { cva, type VariantProps } from "class-variance-authority";
import { splitProps, type ComponentProps } from "solid-js";

import { cn } from "./cn.ts";

// destiny-ui-css variant classes; light keeps its name because exotic gold is what it means
export const VARIANT = {
  default: "",
  light: "gold",
  danger: "danger",
  ghost: "ghost",
} as const;

/*
 * Sizing belongs to the framework, not to us. The old fixed 24/32/40 heights and 10px type
 * squeezed out the padding and the wide tracking that are most of what makes their button look
 * like the game's, so the size variants now just pick a framework class. Icon buttons drop the
 * horizontal padding and take a minimum width instead, since a glyph cannot pad itself square
 */
export const buttonVariants = cva(
  "button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
  {
    variants: {
      variant: VARIANT,
      // The base cannot just assert relative: a caller that needs it out of flow would be
      // fighting a utility in the same layer, where source order decides and nothing is stable
      place: { relative: "relative", absolute: "absolute" },
      size: {
        sm: "small",
        md: "",
        lg: "large",
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
