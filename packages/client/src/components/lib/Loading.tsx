export const Loading = (props: { label: string }) => (
  <div class="animate-delayed-in flex flex-col items-center gap-2 p-4 opacity-0">
    <span
      class="size-7 animate-spin rounded-full border-2 border-t-foreground"
      aria-hidden="true"
    />
    <p class="text-muted-foreground">{props.label}</p>
  </div>
);
