import type { Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { mapResolver } from "../src/resolver.js";
import type { WikiLinksPluginOptions } from "../src/types.js";
import { remarkObsidianWikiLinks } from "../src/wiki-link.js";

const resolver = mapResolver({
  "Wiki Link": { path: "/Wiki Link.md" },
  Nested: { path: "/folder/Nested.md" },
});

function process(markdown: string, options: WikiLinksPluginOptions = {}): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkObsidianWikiLinks, { resolver, ...options });

  return processor.runSync(processor.parse(markdown));
}

describe("remarkObsidianWikiLinks", () => {
  it("resolves a basic Wiki Link through the per-feature plugin", () => {
    const tree = process("[[Wiki Link]]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "link",
          url: "/wiki-link",
          children: [{ type: "text", value: "Wiki Link" }],
        },
      ],
    });
  });

  it("marks an unresolved Wiki Link through the per-feature plugin", () => {
    const tree = process("[[Does Not Exist]]", {
      unresolvedStrategy: "plain",
    });

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [{ type: "text", value: "Does Not Exist" }],
    });
  });

  it("supports Aliases and heading Subpaths through the per-feature plugin", () => {
    const tree = process("[[Wiki Link#Some Heading|Click Here]]");

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      children: [
        {
          type: "link",
          url: "/wiki-link#some-heading",
          children: [{ type: "text", value: "Click Here" }],
        },
      ],
    });
  });
});
