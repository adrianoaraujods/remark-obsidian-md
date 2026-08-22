import { beforeEach, describe, expect, it, vi } from "vitest";

import { getContentMap } from "../src/content-map";
import { getFrontmatter } from "../src/frontmatter";

const FIXTURES_DIR = "tests/fixtures";

describe("getFrontmatter", () => {
  let contentMap: Awaited<ReturnType<typeof getContentMap>>;

  beforeEach(async () => {
    vi.resetModules();
    contentMap = await getContentMap(FIXTURES_DIR);
  });

  it("returns an empty object when given an empty frontmatter", () => {
    expect(getFrontmatter({}, { contentMap })).toEqual({});
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
        { contentMap },
      ),
    ).toEqual({
      title: "Hello World",
      count: 3,
      done: true,
      tags: ["a", "b"],
    });
  });

  it("resolves a standard wiki link to a root-relative url", () => {
    expect(
      getFrontmatter({ related: "[[Wiki Link]]" }, { contentMap }),
    ).toEqual({
      related: { url: "/wiki-link", label: "Wiki Link" },
    });
  });

  it("resolves an aliased wiki link using the alias as label", () => {
    expect(
      getFrontmatter({ related: "[[Wiki Link|Click Here]]" }, { contentMap }),
    ).toEqual({
      related: { url: "/wiki-link", label: "Click Here" },
    });
  });

  it("resolves a wiki link with an anchor", () => {
    expect(
      getFrontmatter({ related: "[[Wiki Link#Some Heading]]" }, { contentMap }),
    ).toEqual({
      related: { url: "/wiki-link#some-heading", label: "Wiki Link" },
    });
  });

  it("resolves an url into a link object", () => {
    expect(
      getFrontmatter({ site: "https://example.com" }, { contentMap }),
    ).toEqual({
      site: { url: "https://example.com", label: "https://example.com" },
    });
  });

  it("degrades an unresolved wiki link to its label", () => {
    expect(
      getFrontmatter({ missing: "[[Does Not Exist]]" }, { contentMap }),
    ).toEqual({
      missing: "Does Not Exist",
    });
  });

  it("ignores keys listed in ignoredKeys", () => {
    expect(
      getFrontmatter(
        { title: "Visible", secret: "Hidden" },
        { contentMap, ignoredKeys: ["secret"] },
      ),
    ).toEqual({ title: "Visible" });
  });

  it("prepends the urlPrefix to resolved links", () => {
    expect(
      getFrontmatter(
        { related: "[[Wiki Link]]" },
        { contentMap, urlPrefix: "/docs" },
      ),
    ).toEqual({
      related: { url: "/docs/wiki-link", label: "Wiki Link" },
    });
  });

  it("resolves wiki links inside arrays", () => {
    expect(
      getFrontmatter({ see: ["[[Wiki Link]]", "plain"] }, { contentMap }),
    ).toEqual({
      see: [{ url: "/wiki-link", label: "Wiki Link" }, "plain"],
    });
  });

  it("keeps plain strings without links untouched", () => {
    expect(getFrontmatter({ note: "just some text" }, { contentMap })).toEqual({
      note: "just some text",
    });
  });

  it("does not resolve a string that only contains a link among other text", () => {
    expect(
      getFrontmatter({ mixed: "See [[Wiki Link]] now" }, { contentMap }),
    ).toEqual({
      mixed: "See [[Wiki Link]] now",
    });
  });

  it("does not resolve a string with multiple links", () => {
    expect(
      getFrontmatter({ multi: "[[A]] and [[B]]" }, { contentMap }),
    ).toEqual({
      multi: "[[A]] and [[B]]",
    });
  });

  it("resolves a link value with surrounding whitespace", () => {
    expect(
      getFrontmatter({ spaced: " [[Wiki Link]] " }, { contentMap }),
    ).toEqual({
      spaced: { url: "/wiki-link", label: "Wiki Link" },
    });
  });
});
