import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import jpeg from "jpeg-js";

import type { ShaderColor } from "@dvm/defs-core";

const BUNGIE_ROOT = "https://www.bungie.net";

// Keeps the icon's frame and highlights out
const MIN_PERCENT = 10;

const CONCURRENCY = 8;

const colorOf = (red: number, green: number, blue: number): ShaderColor => {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const lightness = (max + min) / 2;

  if (max < 0.16) {
    return "black";
  }

  if (chroma < 0.06 || chroma / max < 0.2) {
    if (lightness > 0.8) {
      return "white";
    }

    return lightness < 0.2 ? "black" : "grey";
  }

  let sector = 0;

  if (max === r) {
    sector = (g - b) / chroma;
  } else if (max === g) {
    sector = (b - r) / chroma + 2;
  } else {
    sector = (r - g) / chroma + 4;
  }

  const hue = (sector * 60 + 360) % 360;

  if (hue >= 15 && hue < 70 && max < 0.5) {
    return "brown";
  }

  if (hue < 15 || hue >= 345) {
    return lightness > 0.6 ? "pink" : "red";
  }

  if (hue < 40) {
    return "orange";
  }

  if (hue < 70) {
    return "yellow";
  }

  if (hue < 165) {
    return "green";
  }

  if (hue < 195) {
    return "teal";
  }

  if (hue < 255) {
    return "blue";
  }

  if (hue < 290) {
    return "purple";
  }

  return "pink";
};

/** Percent of an RGBA image in each named color, dropping the slivers */
export const iconColors = (
  pixels: Uint8Array,
): Partial<Record<ShaderColor, number>> => {
  const counts = new Map<ShaderColor, number>();
  const total = pixels.length / 4;

  for (let offset = 0; offset < pixels.length; offset += 4) {
    const color = colorOf(
      pixels[offset]!,
      pixels[offset + 1]!,
      pixels[offset + 2]!,
    );

    counts.set(color, (counts.get(color) ?? 0) + 1);
  }

  return Object.fromEntries(
    [...counts]
      .map(([color, count]) => [color, Math.round((count / total) * 100)] as const)
      .filter(([, percent]) => percent >= MIN_PERCENT)
      .sort((a, b) => b[1] - a[1]),
  );
};

const fetchIcon = async (cacheDir: string, icon: string): Promise<Uint8Array> => {
  const destination = join(cacheDir, basename(icon));

  if (existsSync(destination)) {
    return readFile(destination);
  }

  const response = await fetch(`${BUNGIE_ROOT}${icon}`);

  if (!response.ok) {
    throw new Error(`Icon fetch failed: ${response.status} ${icon}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  await writeFile(destination, bytes);

  return bytes;
};

/** Icon colors for each shader icon path, icons cached by their content hash name */
export const loadShaderColors = async (
  cacheDir: string,
  icons: string[],
): Promise<Map<string, Partial<Record<ShaderColor, number>>>> => {
  await mkdir(cacheDir, { recursive: true });

  const colors = new Map<string, Partial<Record<ShaderColor, number>>>();
  const queue = [...new Set(icons)];

  const work = async () => {
    for (let icon = queue.pop(); icon !== undefined; icon = queue.pop()) {
      const image = jpeg.decode(await fetchIcon(cacheDir, icon), {
        useTArray: true,
        formatAsRGBA: true,
      });

      colors.set(icon, iconColors(image.data));
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, work));

  return colors;
};
