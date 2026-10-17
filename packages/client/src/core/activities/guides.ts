/// <reference types="vite/client" />

export interface Guide {
  name: string;
  body: string;
}

const FILES = import.meta.glob<string>("../../../guides/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const NAME_LINE = /^name:\s*(.+?)\s*$/m;

const GUIDES: Guide[] = Object.entries(FILES).map(([path, text]) => {
  const front = FRONT_MATTER.exec(text);
  const name = front ? NAME_LINE.exec(front[1]!)?.[1] : undefined;

  if (!front || name === undefined) {
    throw new Error(`Guide ${path} has no name in its front matter`);
  }

  return { name, body: text.slice(front[0].length) };
});

/** Looks up by the Activities page name, without a difficulty suffix */
export const guideNamed = (name: string): Guide | undefined =>
  GUIDES.find((guide) => guide.name === name);
