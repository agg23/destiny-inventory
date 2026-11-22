import { afterEach, describe, expect, it, vi } from "vitest";

import { createHandler } from "./handler.ts";
import {
  parseShareId,
  parseSharePage,
  type ShareStore,
} from "./loadoutShare.ts";
import { mintSession } from "./session.ts";

const SECRET = "correct horse battery staple";

const ORIGIN = "http://localhost";

const LOADOUT = {
  id: "4j5nz4q",
  name: "Heart of Inmost Light Arc",
  classType: 0,
  equipped: [{ id: "6917529656823174042", hash: 42253225 }],
  unequipped: [],
  parameters: { mods: [2623485440] },
};

// Markup from https://dim.gg/4j5nz4q on 2026-11-14
const page = (loadout: string) => {
  const query = new URLSearchParams({ loadout }).toString();

  return `<!DOCTYPE html>
<html lang="">
  <head>
    <title>Heart of Inmost Light Arc | DIM Loadout</title>
  </head>
  <body>
    <div class="dim-page">
      <h1>Heart of Inmost Light Arc</h1>
      <p>
        These build settings contain:
        <ul>
          <li>1 items - recipients will have to choose their own copies of these</li>
          <li>Fashion (shaders &amp; ornaments)</li>
        </ul>
      </p>
      <div class="dim-buttons">
        <a class="dim-button" href="https://app.destinyitemmanager.com/loadouts?${query}">Open in DIM</a>
        <a class="dim-button" href="https://beta.destinyitemmanager.com/loadouts?${query}">Open in DIM Beta</a>
      </div>
    </div>
  </body>
</html>`;
};

const memoryShares = (): ShareStore => {
  const shares = new Map<string, object>();

  return {
    read: async (shareId) => shares.get(shareId),
    write: async (shareId, loadout) => {
      shares.set(shareId, loadout);
    },
  };
};

const service = (shares = memoryShares()) =>
  createHandler({
    apiKey: "",
    clientId: "",
    clientSecret: "",
    sessionSecret: SECRET,
    allowedOrigin: ORIGIN,
    authOrigin: ORIGIN,
    loader: { index: async () => undefined, raw: async () => undefined },
    tags: {
      read: async () => ({ defs: [], items: [] }),
      write: async () => undefined,
    },
    notes: { read: async () => [], write: async () => undefined },
    looks: { read: async () => [], write: async () => undefined },
    perkPreferences: { read: async () => [], write: async () => undefined },
    autotag: {
      read: async () => ({ rules: [], state: undefined }),
      write: async () => undefined,
      writeState: async () => false,
    },
    stats: {
      read: async () => [],
      readOne: async () => undefined,
      write: async () => undefined,
    },
    shares,
  });

const share = async (link: string, handler = service()) =>
  handler(
    new Request(
      `${ORIGIN}/loadout-share?${new URLSearchParams({ link }).toString()}`,
      {
        headers: {
          Authorization: `Bearer ${await mintSession(SECRET, "alice", Date.now() + 60_000)}`,
        },
      },
    ),
  );

const serve = (status: number, body: string) => {
  const fetch = vi.fn(async () => new Response(body, { status }));
  vi.stubGlobal("fetch", fetch);

  return fetch;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("share links", () => {
  it("accepts the forms DIM accepts", () => {
    for (const link of [
      "4j5nz4q",
      "dim.gg/4j5nz4q",
      "https://dim.gg/4j5nz4q",
      "https://dim.gg/4j5nz4q/",
      "http://dim.gg/4j5nz4q/Heart-of-Inmost-Light-Arc",
      " https://dim.gg/4j5nz4q\n",
    ]) {
      expect(parseShareId(link)).toBe("4j5nz4q");
    }
  });

  it("rejects anything that isn't a share id", () => {
    expect(parseShareId("4j5")).toBeUndefined();
    expect(parseShareId("https://evil.example/4j5nz4q")).toBeUndefined();
    expect(parseShareId("4j5nz4q?x=1#")).toBeUndefined();
    expect(parseShareId("../../4j5nz4q")).toBeUndefined();
  });
});

describe("share pages", () => {
  it("reads the loadout out of the Open in DIM link", () => {
    expect(parseSharePage(page(JSON.stringify(LOADOUT)))).toEqual(LOADOUT);
  });

  it("gives up on a page without the link", () => {
    expect(parseSharePage("<html><body>Moved</body></html>")).toBeUndefined();
    expect(parseSharePage(page("{not json"))).toBeUndefined();
    expect(parseSharePage(page("[1, 2]"))).toBeUndefined();
  });
});

describe("loadout share route", () => {
  it("refuses a request with no session", async () => {
    const response = await service()(
      new Request(`${ORIGIN}/loadout-share?link=4j5nz4q`),
    );

    expect(response.status).toBe(401);
  });

  it("only ever fetches a dim.gg page", async () => {
    const fetch = serve(200, page(JSON.stringify(LOADOUT)));

    const response = await share("dim.gg/4j5nz4q/Heart-of-Inmost-Light-Arc");

    expect(fetch).toHaveBeenCalledWith("https://dim.gg/4j5nz4q");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ loadout: LOADOUT });

    const refused = await share("https://evil.example/4j5nz4q");

    expect(refused.status).toBe(400);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("fetches each share from dim.gg once", async () => {
    const fetch = serve(200, page(JSON.stringify(LOADOUT)));
    const handler = service();

    const first = await share(
      "https://dim.gg/4j5nz4q/Heart-of-Inmost-Light-Arc",
      handler,
    );
    const second = await share("4j5nz4q", handler);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await first.json()).toEqual({ loadout: LOADOUT });
    expect(await second.json()).toEqual({ loadout: LOADOUT });
  });

  it("doesn't hold on to missing or unreadable shares", async () => {
    const handler = service();

    serve(404, "Not found");
    await share("zzzzzzz", handler);

    const fetch = serve(200, page(JSON.stringify(LOADOUT)));

    expect((await share("zzzzzzz", handler)).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("separates a missing share from an unreadable page", async () => {
    serve(404, "Not found");

    expect((await share("zzzzzzz")).status).toBe(404);

    serve(200, "<html><body>Redesigned</body></html>");

    expect((await share("4j5nz4q")).status).toBe(502);
  });
});
