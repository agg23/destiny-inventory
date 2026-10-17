// TODO: Prototype only. ?playing fakes an online character, ?playing=demo also fills every
// state. Kept on window to survive navigation and hot updates, a reload without it clears it
const held = globalThis as { dvmPreviewPlaying?: string | null };

held.dvmPreviewPlaying ??= new URLSearchParams(location.search).get("playing");

/** True while the status rail prototype is faking an online character */
export const previewPlaying = (): boolean =>
  held.dvmPreviewPlaying === "" ||
  held.dvmPreviewPlaying === "1" ||
  held.dvmPreviewPlaying === "demo";

/** True while the status rail prototype shows every state */
export const previewDemo = (): boolean => held.dvmPreviewPlaying === "demo";
