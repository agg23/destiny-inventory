import { fullDateTime } from "../core/time.ts";
import { remaining } from "../core/todo/reset.ts";

interface Props {
  at: number;
  now: number;
  label: string;
  left?: boolean;
  class?: string;
}

/** Time until a deadline, with the full date on hover */
export const Countdown = (props: Props) => (
  <span class={props.class} title={`${props.label} ${fullDateTime(props.at)}`}>
    {remaining(props.at - props.now)}
    {props.left === false ? "" : " left"}
  </span>
);
