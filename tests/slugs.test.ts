import { describe, expect, it } from "vitest";

import { createSlugifyPath } from "../src/slugs";

describe("createSlugifyPath", () => {
  it("slugifies every segment of a Note path", () => {
    const slugifyPath = createSlugifyPath(["/Programação/Linguagens/C.md"]);

    expect(slugifyPath("/Programação/Linguagens/C.md")).toBe(
      "programacao/linguagens/c",
    );
  });

  it("gives Notes whose names slugify alike distinct slugs", () => {
    const slugifyPath = createSlugifyPath([
      "/Localizações/Sebá.md",
      "/Localizações/Sebã.md",
    ]);

    expect(slugifyPath("/Localizações/Sebá.md")).toBe("localizacoes/seba");
    expect(slugifyPath("/Localizações/Sebã.md")).toBe("localizacoes/seba-2");
  });

  it("numbers a third colliding Note", () => {
    const slugifyPath = createSlugifyPath([
      "/A/Sebá.md",
      "/A/Sebà.md",
      "/A/Sebã.md",
    ]);

    // Paths are sorted, so `Sebà` (à) comes before `Sebá` (á) and `Sebã` (ã).
    expect(slugifyPath("/A/Sebà.md")).toBe("a/seba");
    expect(slugifyPath("/A/Sebá.md")).toBe("a/seba-2");
    expect(slugifyPath("/A/Sebã.md")).toBe("a/seba-3");
  });

  it("assigns the same slugs whatever the order of the paths", () => {
    const paths = ["/A/Sebá.md", "/A/Sebã.md", "/A/Other.md"];

    expect(createSlugifyPath(paths)("/A/Sebã.md")).toBe(
      createSlugifyPath([...paths].reverse())("/A/Sebã.md"),
    );
  });

  it("publishes an index Note under its folder", () => {
    const slugifyPath = createSlugifyPath(["/Notes/index.md"]);

    expect(slugifyPath("/Notes/index.md")).toBe("notes");
  });

  it("keeps an index Note apart from a Note with the same name", () => {
    const slugifyPath = createSlugifyPath(["/Notes.md", "/Notes/index.md"]);

    expect(slugifyPath("/Notes.md")).toBe("notes");
    expect(slugifyPath("/Notes/index.md")).toBe("notes/index");
  });

  it("never takes the slug another Note already owns", () => {
    const slugifyPath = createSlugifyPath([
      "/A/Sebá.md",
      "/A/Sebã.md",
      "/A/Sebá-2.md",
    ]);

    expect(slugifyPath("/A/Sebá.md")).toBe("a/seba");
    expect(slugifyPath("/A/Sebá-2.md")).toBe("a/seba-2");
    expect(slugifyPath("/A/Sebã.md")).toBe("a/seba-3");
  });

  it("numbers two index Notes that slugify alike", () => {
    const slugifyPath = createSlugifyPath([
      "/Notes/index.md",
      "/notes/index.md",
    ]);

    expect(slugifyPath("/Notes/index.md")).toBe("notes");
    expect(slugifyPath("/notes/index.md")).toBe("notes-2");
  });

  it("falls back to a plain slug for unknown paths", () => {
    const slugifyPath = createSlugifyPath(["/Notes/One.md"]);

    expect(slugifyPath("/Notes/Two.md")).toBe("notes/two");
  });

  it("keeps the folder of an unknown index Note", () => {
    const slugifyPath = createSlugifyPath(["/Notes/One.md"]);

    expect(slugifyPath("/Unknown/index.md")).toBe("unknown/index");
  });

  it("honours a custom slugify", () => {
    const slugifyPath = createSlugifyPath(["/Notes/One.md"], {
      slugify: (text) => text.toUpperCase(),
    });

    expect(slugifyPath("/Notes/One.md")).toBe("NOTES/ONE");
  });
});
