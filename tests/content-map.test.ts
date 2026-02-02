import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Type for the module import
import type * as ContentMapModule from "../src/content-map";

describe("getContentMap", () => {
  let getContentMap: typeof ContentMapModule.getContentMap;

  const fixturesDir = path.join(process.cwd(), "tests/fixtures");

  beforeEach(async () => {
    // Clear the cache (the global `let contentMap` variable)
    vi.resetModules();

    // Re-import the module to get a fresh state
    const module = await import("../src/content-map");
    getContentMap = module.getContentMap;
  });

  it("should find markdown files in the root", async () => {
    const result = await getContentMap(fixturesDir);

    expect(result.get("wiki links")).toEqual({
      type: "md",
      path: "/Wiki Links.md",
    });
  });

  it("should find nested markdown files (recursive)", async () => {
    const result = await getContentMap(fixturesDir);

    expect(result.get("nested")).toEqual({
      type: "md",
      path: "/folder/Nested.md",
    });
  });

  it("should find valid images and calculate dimensions", async () => {
    const result = await getContentMap(fixturesDir);
    const image = result.get("image.png");

    expect(image).toBeDefined();
    expect(image).toEqual({
      type: "img",
      path: "/Image.png",
      width: 400,
      height: 400,
    });
  });

  it("should ignore files that are not md or images", async () => {
    const result = await getContentMap(fixturesDir);

    // random.txt should not be in the map
    expect(result.get("file")).toBeUndefined();
    expect(result.get("file.txt")).toBeUndefined();
  });

  it("should ignore corrupt images", async () => {
    const result = await getContentMap(fixturesDir);

    // Corrupt.png should be skipped because image-size throws/returns undefined
    expect(result.get("Corrupt.png")).toBeUndefined();
  });

  it("should use the memoized cache on subsequent calls", async () => {
    // First Call
    const map1 = await getContentMap(fixturesDir);

    // Second Call
    const map2 = await getContentMap(fixturesDir);

    // Ensure strictly equal reference (same object in memory)
    expect(map1).toBe(map2);
  });
});
