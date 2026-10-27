import { describe, expect, it } from "vitest";

import { slugify } from "../src/utils";

describe("slugify", () => {
  it("lowercases, strips accents and hyphenates words", () => {
    expect(slugify("Some Note")).toBe("some-note");
    expect(slugify("Programação")).toBe("programacao");
    expect(slugify("myPostTitle")).toBe("my-post-title");
    expect(slugify("  Spaced  Out  ")).toBe("spaced-out");
  });

  it("spells symbols that follow a word so names stay distinct", () => {
    expect(slugify("C++")).toBe("c-plus-plus");
    expect(slugify("C#")).toBe("c-sharp");
    expect(slugify("F#")).toBe("f-sharp");
    expect(slugify("Árvore B+")).toBe("arvore-b-plus");
    expect(slugify("C# 10")).toBe("c-sharp-10");
    expect(slugify("  C++  ")).toBe("c-plus-plus");
  });

  it("keeps a note distinct from its symbol-free sibling", () => {
    expect(slugify("C++")).not.toBe(slugify("C"));
    expect(slugify("C#")).not.toBe(slugify("C"));
  });

  it("still drops a symbol that does not follow a word", () => {
    expect(slugify("#tag")).toBe("tag");
  });
});
