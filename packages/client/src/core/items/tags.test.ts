import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posts: { items: { tagId: string; ruleId?: string }[] }[] = [];

let answer: () => Promise<Response> = async () =>
  new Response("{}", { status: 503 });

vi.mock("../api/auth.ts", () => ({
  callService: async (path: string, init?: RequestInit) => {
    if (path.includes("?since=")) {
      return new Response(JSON.stringify({ defs: [], items: [], now: 1 }));
    }

    posts.push(JSON.parse(init?.body as string));

    return answer();
  },
}));

const TARGET = { instanceId: "6917529000000000001", itemHash: 1 };

const storedQueue = (): { tagId: string; removed: boolean }[] =>
  JSON.parse(localStorage.getItem("dvm.tags") ?? "{}").queued ?? [];

describe("tag write queue", () => {
  beforeEach(() => {
    localStorage.clear();
    posts.length = 0;
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a failed write across a reload", async () => {
    answer = async () => new Response("{}", { status: 503 });

    const first = await import("./tags.ts");

    first.writeRuleTags([TARGET], "junk", "rule");
    await vi.advanceTimersByTimeAsync(500);

    expect(posts).toHaveLength(1);
    expect(storedQueue()).toHaveLength(1);

    vi.resetModules();
    answer = async () => new Response(JSON.stringify({ now: 2 }));

    const second = await import("./tags.ts");

    await second.syncTags();
    await vi.advanceTimersByTimeAsync(500);

    expect(posts).toHaveLength(2);
    expect(posts[1]?.items[0]).toMatchObject({ tagId: "junk", ruleId: "rule" });
    expect(storedQueue()).toHaveLength(0);
  });

  it("keeps a change made while a write is in flight", async () => {
    let release: (response: Response) => void = () => undefined;

    answer = () => new Promise((resolve) => (release = resolve));

    const { setOnlyTag, writeRuleTags } = await import("./tags.ts");

    writeRuleTags([TARGET], "junk", "rule");
    await vi.advanceTimersByTimeAsync(500);

    setOnlyTag(TARGET.instanceId, TARGET.itemHash, "keep");
    release(new Response(JSON.stringify({ now: 2 })));
    await vi.advanceTimersByTimeAsync(0);

    expect(
      storedQueue().map((item) => [item.tagId, item.removed]),
    ).toEqual([
      ["junk", true],
      ["keep", false],
    ]);
  });
});
