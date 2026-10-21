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

  it("resolves an url into a link object", () => {
    expect(
      getFrontmatter({ site: "https://example.com" }, { resolver }),
    ).toEqual({
      site: { url: "https://example.com", label: "https://example.com" },
    });
  });

  it("degrades an unresolved wiki link to its label", () => {
    expect(
      getFrontmatter({ missing: "[[Does Not Exist]]" }, { resolver }),
    ).toEqual({
      missing: "Does Not Exist",
    });
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
