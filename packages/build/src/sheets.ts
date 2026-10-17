// The CSV export 429s permanently on these sheets. htmlview serves the same cells
export const sheetUrl = (sheet: string, gid: string): string =>
  `https://docs.google.com/spreadsheets/d/${sheet}/htmlview/sheet?headers=true&gid=${gid}`;

export const indexUrl = (sheet: string): string =>
  `https://docs.google.com/spreadsheets/d/${sheet}/htmlview`;

export interface Tab {
  gid: string;
  name: string;
}

export const fetchText = async (url: string): Promise<string> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Sheet fetch failed: ${response.status} ${url}`);
  }

  return response.text();
};

const decodeEntities = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#([0-9]+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();

export const parseRows = (html: string): string[][] => {
  const rows: string[][] = [];

  for (const [, body = ""] of html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)) {
    const cells: string[] = [];

    for (const [, cell = ""] of body.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)) {
      cells.push(decodeEntities(cell));
    }

    rows.push(cells);
  }

  return rows;
};

export const fetchTabs = async (sheet: string): Promise<Tab[]> => {
  const html = await fetchText(indexUrl(sheet));
  const tabs: Tab[] = [];

  for (const [, name = "", gid = ""] of html.matchAll(
    /items\.push\(\{name: "((?:[^"\\]|\\.)*)".*?gid: "([0-9]+)"/g,
  )) {
    // The JS bootstrap escapes "&" as \x26
    const unescaped = name.replace(/\\x([0-9a-f]{2})/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );

    tabs.push({ gid, name: JSON.parse(`"${unescaped}"`) as string });
  }

  if (tabs.length === 0) {
    throw new Error(
      "Sheet index listed no tabs, the htmlview bootstrap changed",
    );
  }

  return tabs;
};

const headerRow = (rows: string[][], label: string): number => {
  for (let index = 0; index < Math.min(rows.length, 8); index += 1) {
    if (rows[index]?.includes(label)) {
      return index;
    }
  }

  return -1;
};

/** A tab's rows below its header, with a lookup of a row's cell by header label */
export const readTab = async (sheet: string, tab: Tab, header: string) => {
  const rows = parseRows(await fetchText(sheetUrl(sheet, tab.gid)));
  const at = headerRow(rows, header);

  if (at < 0) {
    throw new Error(`Tab ${tab.name} has no header row`);
  }

  const columns = rows[at]!;
  const column = (row: string[], label: string): string | undefined => {
    const index = columns.indexOf(label);

    return index < 0 ? undefined : row[index];
  };

  return { rows: rows.slice(at + 1), column };
};
