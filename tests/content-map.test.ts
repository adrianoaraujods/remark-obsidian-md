import { beforeEach, describe, expect, it, vi } from "vitest";

// Type for the module import
import type * as ContentMapModule from "../src/content-map";

const FIXTURES_DIR = "tests/fixtures";

describe("getContentMap", () => {
  let getContentMap: typeof ContentMapModule.getContentMap;

  beforeEach(async () => {
    // Clear the cache (the global `let contentMap` variable)
    vi.resetModules();

    // Re-import the module to get a fresh state
    const module = await import("../src/content-map");
    getContentMap = module.getContentMap;
  });

  it("should find markdown files in the root", async () => {
    const result = await getContentMap(FIXTURES_DIR);

    expect(result.get("wiki links")).toEqual({
      type: "md",
      path: "/Wiki Links.md",
    });
  });

  it("should find nested markdown files (recursive)", async () => {
    const result = await getContentMap(FIXTURES_DIR);

    expect(result.get("nested")).toEqual({
      type: "md",
      path: "/folder/Nested.md",
    });
  });

  it("should ignore files that are not md or images", async () => {
    const result = await getContentMap(FIXTURES_DIR);

    // random.txt should not be in the map
    expect(result.get("file")).toBeUndefined();
    expect(result.get("file.txt")).toBeUndefined();
  });

  it("should ignore image files", async () => {
    const result = await getContentMap(FIXTURES_DIR);

    // Image.png should not be scanned (image support was removed)
    expect(result.get("image.png")).toBeUndefined();
  });

  it("should use the memoized cache on subsequent calls", async () => {
    // First Call
    const map1 = await getContentMap(FIXTURES_DIR);

    // Second Call
    const map2 = await getContentMap(FIXTURES_DIR);

    // Ensure strictly equal reference (same object in memory)
    expect(map1).toBe(map2);
  });
});
