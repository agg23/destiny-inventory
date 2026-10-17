import { splitProps } from "solid-js";

import { Button, type ButtonProps } from "./zaidan/button.tsx";

type Props = ButtonProps & { label: string };

/** A ghost icon button whose label is both its tooltip and accessible name */
export const IconButton = (props: Props) => {
  const [local, rest] = splitProps(props, ["label"]);

  return (
    <Button
      variant="ghost"
      title={local.label}
      aria-label={local.label}
      {...rest}
    />
  );
};
