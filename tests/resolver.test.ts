import { describe, expect, it } from "vitest";

import { mapResolver } from "../src/resolver";

const resolver = mapResolver({
  "Wiki Link": {
    path: "/Wiki Link.md",
    title: "Wiki Link",
    aliases: ["home"],
    cssclasses: ["wide"],
  },
  Nested: { path: "/folder/Nested.md" },
});

describe("mapResolver", () => {
  it("resolves a note with its metadata", () => {
    expect(resolver.resolve("Wiki Link")).toEqual({
      kind: "note",
      exists: true,
      path: "/Wiki Link.md",
      note: {
        title: "Wiki Link",
        aliases: ["home"],
        cssclasses: ["wide"],
      },
    });
  });

  it("matches case-insensitively and with or without the extension", () => {
    expect(resolver.resolve("wiki link")).toMatchObject({
      exists: true,
      path: "/Wiki Link.md",
    });
    expect(resolver.resolve("WIKI LINK.MD")).toMatchObject({
      exists: true,
      path: "/Wiki Link.md",
    });
  });

  it("matches path segments and Aliases", () => {
    expect(resolver.resolve("folder/Nested")).toMatchObject({
      exists: true,
      path: "/folder/Nested.md",
    });
    expect(resolver.resolve("Nested")).toMatchObject({
      exists: true,
      path: "/folder/Nested.md",
    });
    expect(resolver.resolve("home")).toMatchObject({
      exists: true,
      path: "/Wiki Link.md",
    });
  });

  it("resolves duplicate basenames root-wins, matching the filesystem Resolver", () => {
    const dupes = mapResolver({
      "folder/Dup": { path: "/folder/Dup.md" },
      Dup: { path: "/Dup.md" },
    });

    expect(dupes.resolve("Dup")).toMatchObject({
      exists: true,
      path: "/Dup.md",
    });
    expect(dupes.resolve("folder/Dup")).toMatchObject({
      exists: true,
      path: "/folder/Dup.md",
    });
  });

  it("reports an unresolved target as a missing note", () => {
    expect(resolver.resolve("Does Not Exist")).toEqual({
      kind: "note",
      exists: false,
    });
  });
});
