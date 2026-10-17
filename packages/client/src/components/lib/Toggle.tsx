import { Switch } from "./zaidan/switch.tsx";

interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const Toggle = (props: Props) => (
  <label class="flex cursor-pointer items-center justify-between gap-4 select-none">
    {props.label}
    <Switch checked={props.checked} onChange={props.onChange} />
  </label>
);
