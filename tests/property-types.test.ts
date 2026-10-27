import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { filesystemPropertyTypes } from "../src/property-types";

function vaultWithTypesFile(content: string): string {
  const vault = mkdtempSync(join(tmpdir(), "vault-"));
  mkdirSync(join(vault, ".obsidian"));
  writeFileSync(join(vault, ".obsidian", "types.json"), content);
  return vault;
}

describe("filesystemPropertyTypes", () => {
  it("reads the property type map from .obsidian/types.json", () => {
    const vault = vaultWithTypesFile(
      JSON.stringify({
        types: {
          aliases: "aliases",
          tags: "tags",
          Escrito: "datetime",
          Professor: "multitext",
          Verbal: "checkbox",
        },
      }),
    );

    expect(filesystemPropertyTypes(vault)).toEqual({
      aliases: "aliases",
      tags: "tags",
      Escrito: "datetime",
      Professor: "multitext",
      Verbal: "checkbox",
    });
  });

  it("returns an empty map when the vault has no .obsidian/types.json", () => {
    const vault = mkdtempSync(join(tmpdir(), "vault-"));

    expect(filesystemPropertyTypes(vault)).toEqual({});
  });

  it("returns an empty map for malformed JSON or unexpected shapes", () => {
    expect(filesystemPropertyTypes(vaultWithTypesFile("{nope"))).toEqual({});

    expect(
      filesystemPropertyTypes(
        vaultWithTypesFile(JSON.stringify({ types: "nope" })),
      ),
    ).toEqual({});

    expect(
      filesystemPropertyTypes(vaultWithTypesFile(JSON.stringify({ types: 3 }))),
    ).toEqual({});
  });

  it("skips non-string type values", () => {
    expect(
      filesystemPropertyTypes(
        vaultWithTypesFile(
          JSON.stringify({ types: { Escrito: "datetime", x: 3 } }),
        ),
      ),
    ).toEqual({ Escrito: "datetime" });
  });
});
