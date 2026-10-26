import { describe, expect, it } from "vitest";

import { getFrontmatter } from "../src/frontmatter";
import { mapResolver } from "../src/resolver";

const resolver = mapResolver({
  "Wiki Link": { path: "/Wiki Link.md", title: "Wiki Link" },
});

describe("getFrontmatter", () => {
  it("returns an empty object when given an empty frontmatter", () => {
    expect(getFrontmatter({}, { resolver })).toEqual({});
  });

  it("returns primitives unchanged", () => {
    expect(
      getFrontmatter(
        {
          title: "Hello World",
          count: 3,
          done: true,
          tags: ["a", "b"],
        },
        { resolver },
      ),
    ).toEqual({
      title: "Hello World",
      count: 3,
      done: true,
      tags: ["a", "b"],
    });
  });

  it("resolves a standard wiki link to a root-relative url", () => {
    expect(getFrontmatter({ related: "[[Wiki Link]]" }, { resolver })).toEqual({
      related: { url: "/wiki-link", label: "Wiki Link" },
    });
  });

  it("resolves an aliased wiki link using the alias as label", () => {
    expect(
      getFrontmatter({ related: "[[Wiki Link|Click Here]]" }, { resolver }),
    ).toEqual({
      related: { url: "/wiki-link", label: "Click Here" },
    });
  });

  it("resolves a wiki link with an anchor", () => {
    expect(
      getFrontmatter({ related: "[[Wiki Link#Some Heading]]" }, { resolver }),
    ).toEqual({
      related: { url: "/wiki-link#some-heading", label: "Wiki Link" },
    });
  });

  it("keeps embed syntax unchanged: frontmatter stories only cover Wiki Links", () => {
    expect(getFrontmatter({ embed: "![[Wiki Link]]" }, { resolver })).toEqual({
      embed: "![[Wiki Link]]",
    });
  });

  it("resolves an url into a link object", () => {
    const result = getFrontmatter(
      { site: "https://example.com" },
      { resolver },
    );

    expect(result).toEqual({
      site: { url: "https://example.com", label: "https://example.com" },
    });
    expect(result.site).not.toHaveProperty("unresolved");
  });

  it("treats a markdown link as an external reference", () => {
    const result = getFrontmatter(
      {
        source:
          "[YouTube, Marcos Kutova - AEDS III](https://www.youtube.com/watch?v=qcSh3jh_o0Q&list=PLKoAQTS8rBFp0ZRb_9fhEyY3nryg5iixU)",
      },
      { resolver },
    );

    expect(result).toEqual({
      source: {
        url: "https://www.youtube.com/watch?v=qcSh3jh_o0Q&list=PLKoAQTS8rBFp0ZRb_9fhEyY3nryg5iixU",
        label: "YouTube, Marcos Kutova - AEDS III",
      },
    });
    expect(result.source).not.toHaveProperty("unresolved");
  });

  it("treats markdown links inside arrays as external references", () => {
    expect(
      getFrontmatter(
        {
          fontes: [
            "[GitHub, AEDS II - Slides Heapsort](https://github.com/icei-pucminas/aeds2/blob/master/heapsort.pdf)",
            "[Wiki, Heapsort (C)](https://en.wikipedia.org/wiki/Heapsort_(algorithm))",
          ],
        },
        { resolver },
      ),
    ).toEqual({
      fontes: [
        {
          url: "https://github.com/icei-pucminas/aeds2/blob/master/heapsort.pdf",
          label: "GitHub, AEDS II - Slides Heapsort",
        },
        {
          url: "https://en.wikipedia.org/wiki/Heapsort_(algorithm)",
          label: "Wiki, Heapsort (C)",
        },
      ],
    });
  });

  it("emits a non-URL markdown link target verbatim", () => {
    expect(
      getFrontmatter({ site: "[Docs](www.example.com)" }, { resolver }),
    ).toEqual({ site: { url: "www.example.com", label: "Docs" } });
  });

  it("keeps strings that merely contain markdown links unchanged", () => {
    const mixed = "See [one](https://a.example) and [two](https://b.example)";
    expect(getFrontmatter({ mixed }, { resolver })).toEqual({ mixed });
  });

  it("keeps malformed markdown links unchanged", () => {
    const broken = "[no closing paren](https://example.com";
    expect(getFrontmatter({ broken }, { resolver })).toEqual({ broken });
  });

  it("marks an unresolved wiki link instead of degrading to plain text", () => {
    expect(
      getFrontmatter({ missing: "[[Does Not Exist]]" }, { resolver }),
    ).toEqual({
      missing: { label: "Does Not Exist", unresolved: true },
    });
  });

  it("marks unresolved wiki links inside arrays and nested objects", () => {
    expect(
      getFrontmatter(
        { meta: { list: ["[[Wiki Link]]", "[[Nope]]"] } },
        { resolver },
      ),
    ).toEqual({
      meta: {
        list: [
          { url: "/wiki-link", label: "Wiki Link" },
          { label: "Nope", unresolved: true },
        ],
      },
    });
  });

  it("tags a date declared in types as date/datetime", () => {
    expect(
      getFrontmatter(
        {
          Escrito: "2026-02-17T11:33",
          Created: "2025-02-03",
        },
        { resolver, types: { Escrito: "datetime", Created: "date" } },
      ),
    ).toEqual({
      Escrito: { date: "2026-02-17T11:33", kind: "datetime" },
      Created: { date: "2025-02-03", kind: "date" },
    });
  });

  it("keeps values whose shape does not match the declared type", () => {
    const frontmatter = {
      Escrito: "2025-02-03",
      Created: "2026-02-17T11:33",
      Broken: "2026-02-30",
    };

    expect(
      getFrontmatter(frontmatter, {
        resolver,
        types: { Escrito: "datetime", Created: "date", Broken: "date" },
      }),
    ).toEqual(frontmatter);
  });

  it("tags undeclared whole-value ISO dates and datetimes", () => {
    expect(
      getFrontmatter(
        {
          Data: "2025-02-03",
          updated: "2026-02-17T11:33:00.000Z",
          other: "2026-02-17 09:51",
        },
        { resolver },
      ),
    ).toEqual({
      Data: { date: "2025-02-03", kind: "date" },
      updated: { date: "2026-02-17T11:33:00.000Z", kind: "datetime" },
      other: { date: "2026-02-17 09:51", kind: "datetime" },
    });
  });

  it("keeps ISO values whose property is declared as a non-date type", () => {
    expect(
      getFrontmatter(
        { Data: "2025-02-03", text: "2025-02-03" },
        { resolver, types: { Data: "text" } },
      ),
    ).toEqual({
      Data: "2025-02-03",
      text: { date: "2025-02-03", kind: "date" },
    });
  });

  it("keeps invalid, nested and array date-ish values unchanged", () => {
    const frontmatter = {
      not: "2026-13-01",
      midnight: "2026-02-30",
      late: "2026-02-17T25:00",
      meta: { nested: "2025-02-03" },
      list: ["2025-02-03", "2025-08-05"],
      text: "2025-02-03 was a good day",
    };

    expect(getFrontmatter(frontmatter, { resolver })).toEqual(frontmatter);
  });

  it("keeps a declared-datetime array untouched like Obsidian", () => {
    const frontmatter = { Escrito: ["2026-02-17T11:33", "2025-02-03"] };

    expect(
      getFrontmatter(frontmatter, { resolver, types: { Escrito: "datetime" } }),
    ).toEqual(frontmatter);
  });

  it("trims surrounding whitespace before tagging a date", () => {
    expect(
      getFrontmatter(
        { Escrito: "  2026-02-17T11:33  " },
        { resolver, types: { Escrito: "datetime" } },
      ),
    ).toEqual({ Escrito: { date: "2026-02-17T11:33", kind: "datetime" } });
  });

  it("ignores keys listed in ignoredKeys", () => {
    expect(
      getFrontmatter(
        { title: "Visible", secret: "Hidden" },
        { resolver, ignoredKeys: ["secret"] },
      ),
    ).toEqual({ title: "Visible" });
  });

  it("prepends the urlPrefix to resolved links", () => {
    expect(
      getFrontmatter(
        { related: "[[Wiki Link]]" },
        { resolver, urlPrefix: "/docs" },
      ),
    ).toEqual({
      related: { url: "/docs/wiki-link", label: "Wiki Link" },
    });
  });

  it("uses a custom slugify function", () => {
    expect(
      getFrontmatter(
        { related: "[[Wiki Link]]" },
        { resolver, slugify: (text) => text.replace(/\s+/g, "_") },
      ),
    ).toEqual({
      related: { url: "/Wiki_Link", label: "Wiki Link" },
    });
  });

  it("resolves wiki links inside arrays", () => {
    expect(
      getFrontmatter({ see: ["[[Wiki Link]]", "plain"] }, { resolver }),
    ).toEqual({
      see: [{ url: "/wiki-link", label: "Wiki Link" }, "plain"],
    });
  });

  it("resolves wiki links in nested objects and arrays", () => {
    expect(
      getFrontmatter(
        {
          meta: {
            related: "[[Wiki Link]]",
            list: ["[[Wiki Link]]", 1],
            keep: { text: "See [[Wiki Link]] now" },
          },
        },
        { resolver },
      ),
    ).toEqual({
      meta: {
        related: { url: "/wiki-link", label: "Wiki Link" },
        list: [{ url: "/wiki-link", label: "Wiki Link" }, 1],
        keep: { text: "See [[Wiki Link]] now" },
      },
    });
  });

  it("keeps plain strings without links untouched", () => {
    expect(getFrontmatter({ note: "just some text" }, { resolver })).toEqual({
      note: "just some text",
    });
  });

  it("does not resolve a string that only contains a link among other text", () => {
    expect(
      getFrontmatter({ mixed: "See [[Wiki Link]] now" }, { resolver }),
    ).toEqual({
      mixed: "See [[Wiki Link]] now",
    });
  });

  it("does not resolve a string with multiple links", () => {
    expect(getFrontmatter({ multi: "[[A]] and [[B]]" }, { resolver })).toEqual({
      multi: "[[A]] and [[B]]",
    });
  });

  it("resolves a link value with surrounding whitespace", () => {
    expect(getFrontmatter({ spaced: " [[Wiki Link]] " }, { resolver })).toEqual(
      {
        spaced: { url: "/wiki-link", label: "Wiki Link" },
      },
    );
  });
});
