import * as DialogPrimitive from "@kobalte/core/dialog";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type { Component, ComponentProps, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "../cn.ts";

const Dialog: Component<DialogPrimitive.DialogRootProps> = (props) => {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
};

const DialogPortal: Component<DialogPrimitive.DialogPortalProps> = (props) => {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
};

type DialogOverlayProps<T extends ValidComponent = "div"> = PolymorphicProps<
  T,
  DialogPrimitive.DialogOverlayProps<T>
> &
  Pick<ComponentProps<T>, "class">;

const DialogOverlay = <T extends ValidComponent = "div">(props: DialogOverlayProps<T>) => {
  const [local, others] = splitProps(props as DialogOverlayProps, ["class"]);
  return (
    <DialogPrimitive.Overlay
      class={cn("z-dialog-overlay fixed inset-0 isolate z-50", local.class)}
      data-slot="dialog-overlay"
      {...others}
    />
  );
};

type DialogContentProps<T extends ValidComponent = "div"> = PolymorphicProps<
  T,
  DialogPrimitive.DialogContentProps<T>
> &
  Pick<ComponentProps<T>, "class">;

const DialogContent = <T extends ValidComponent = "div">(props: DialogContentProps<T>) => {
  const [local, others] = splitProps(props as DialogContentProps, ["class"]);
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        class={cn(
          "fixed top-1/2 left-1/2 z-50 z-dialog-content w-full -translate-x-1/2 -translate-y-1/2 outline-none",
          local.class,
        )}
        data-slot="dialog-content"
        {...others}
      />
    </DialogPortal>
  );
};

type DialogHeaderProps = ComponentProps<"div">;

const DialogHeader = (props: DialogHeaderProps) => {
  const [local, others] = splitProps(props, ["class"]);
  return <div class={cn("z-dialog-header", local.class)} data-slot="dialog-header" {...others} />;
};

type DialogFooterProps = ComponentProps<"div">;

const DialogFooter = (props: DialogFooterProps) => {
  const [local, others] = splitProps(props, ["class"]);
  return <div class={cn("z-dialog-footer", local.class)} data-slot="dialog-footer" {...others} />;
};

type DialogTitleProps<T extends ValidComponent = "h2"> = PolymorphicProps<
  T,
  DialogPrimitive.DialogTitleProps<T>
> &
  Pick<ComponentProps<T>, "class">;

const DialogTitle = <T extends ValidComponent = "h2">(props: DialogTitleProps<T>) => {
  const [local, others] = splitProps(props as DialogTitleProps, ["class"]);
  return (
    <DialogPrimitive.Title
      class={cn("z-dialog-title", local.class)}
      data-slot="dialog-title"
      {...others}
    />
  );
};

type DialogDescriptionProps<T extends ValidComponent = "p"> = PolymorphicProps<
  T,
  DialogPrimitive.DialogDescriptionProps<T>
> &
  Pick<ComponentProps<T>, "class">;

const DialogDescription = <T extends ValidComponent = "p">(props: DialogDescriptionProps<T>) => {
  const [local, others] = splitProps(props as DialogDescriptionProps, ["class"]);
  return (
    <DialogPrimitive.Description
      class={cn("z-dialog-description", local.class)}
      data-slot="dialog-description"
      {...others}
    />
  );
};

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
};
