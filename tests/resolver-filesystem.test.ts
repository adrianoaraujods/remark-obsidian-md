import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { filesystemResolver } from "../src/resolver";

const FIXTURES = fileURLToPath(new URL("fixtures", import.meta.url));

describe("filesystemResolver", () => {
  it("scans the Vault recursively and returns Note metadata", () => {
    const resolver = filesystemResolver(FIXTURES);

    expect(resolver.resolve("Aliased")).toEqual({
      kind: "note",
      exists: true,
      path: "/Aliased.md",
      note: {
        title: "Aliased",
        aliases: ["Home", "Start Here"],
        cssclasses: ["wide", "cards"],
      },
    });

    expect(resolver.resolve("folder/Nested")).toMatchObject({
      kind: "note",
      exists: true,
      path: "/folder/Nested.md",
    });
  });

  it("exposes the Note paths it scanned", () => {
    const resolver = filesystemResolver(FIXTURES);

    expect(resolver.paths).toEqual(
      expect.arrayContaining(["/Aliased.md", "/folder/Nested.md"]),
    );
    expect(resolver.paths).not.toContain("/Image.png");
  });

  it("matches case-insensitively and with or without the .md extension", () => {
    const resolver = filesystemResolver(FIXTURES);

    for (const target of ["ALIASED", "aliased", "Aliased.md", "ALIASED.MD"]) {
      expect(resolver.resolve(target)).toMatchObject({
        kind: "note",
        exists: true,
        path: "/Aliased.md",
      });
    }
  });

  it("resolves Aliases as Link Targets", () => {
    const resolver = filesystemResolver(FIXTURES);

    expect(resolver.resolve("home")).toMatchObject({
      kind: "note",
      path: "/Aliased.md",
    });
    expect(resolver.resolve("start here")).toMatchObject({
      kind: "note",
      path: "/Aliased.md",
    });
  });

  it("resolves duplicate basenames root-wins by default, with a configurable policy", () => {
    const rootWins = filesystemResolver(FIXTURES);
    expect(rootWins.resolve("Duplicate")).toMatchObject({
      path: "/Duplicate.md",
    });

    const lastWins = filesystemResolver(FIXTURES, { duplicatePolicy: "last" });
    expect(lastWins.resolve("duplicate")).toMatchObject({
      path: "/folder/duplicate.md",
    });
  });

  it("resolves Assets by name and reports their extension", () => {
    const resolver = filesystemResolver(FIXTURES);

    expect(resolver.resolve("Image.png")).toEqual({
      kind: "asset",
      exists: true,
      path: "/Image.png",
      ext: ".png",
    });
    expect(resolver.resolve("folder/nested.png")).toMatchObject({
      kind: "asset",
      path: "/folder/Nested.png",
    });
  });

  it("tolerates Notes with corrupt Frontmatter", () => {
    expect(filesystemResolver(FIXTURES).resolve("Corrupt Frontmatter")).toEqual(
      {
        kind: "note",
        exists: true,
        path: "/Corrupt Frontmatter.md",
        note: {
          title: "Corrupt Frontmatter",
          aliases: [],
          cssclasses: [],
        },
      },
    );
  });

  it("reports an unresolved target as a missing note", () => {
    expect(filesystemResolver(FIXTURES).resolve("Does Not Exist")).toEqual({
      kind: "note",
      exists: false,
    });
  });

  it("caches the scan for the lifetime of the Resolver", () => {
    const vault = mkdtempSync(join(tmpdir(), "obsidian-vault-"));
    writeFileSync(join(vault, "One.md"), "# One");

    const resolver = filesystemResolver(vault);
    expect(resolver.resolve("One")).toMatchObject({ exists: true });

    writeFileSync(join(vault, "Two.md"), "# Two");
    expect(resolver.resolve("Two")).toEqual({ kind: "note", exists: false });
    expect(filesystemResolver(vault).resolve("Two")).toMatchObject({
      exists: true,
    });
  });
});
