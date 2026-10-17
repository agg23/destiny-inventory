/** A stored JSON value, or undefined when it is missing or unreadable */
export const readStored = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);

    return raw ? (JSON.parse(raw) as unknown) : undefined;
  } catch {
    return undefined;
  }
};

export const writeStored = (key: string, value: unknown) =>
  localStorage.setItem(key, JSON.stringify(value));
