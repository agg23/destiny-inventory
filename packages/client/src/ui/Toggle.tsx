interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const Toggle = (props: Props) => (
  <label class="checkbox leftCheck setting-toggle">
    <input
      type="checkbox"
      checked={props.checked}
      onChange={(e) => props.onChange(e.currentTarget.checked)}
    />
    <span class="section-label">{props.label}</span>
  </label>
);
