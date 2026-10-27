import type { Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import remarkObsidianMd, { remarkObsidianComments } from "../src/index.js";
import { mapResolver } from "../src/resolver.js";

const resolver = mapResolver({});

function process(markdown: string): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkObsidianMd, { resolver });

  return processor.runSync(processor.parse(markdown));
}

function processStandalone(markdown: string): Root {
  const processor = unified().use(remarkParse).use(remarkObsidianComments);

  return processor.runSync(processor.parse(markdown));
}

function textOf(node: unknown): string {
  if (typeof node !== "object" || node === null) return "";
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node && Array.isArray(node.children)) {
    return node.children.map(textOf).join("");
  }
  return "";
}

describe("Comments", () => {
  it("removes an inline comment and keeps the text after it", () => {
    const tree = process("before %%hidden%% after");

    expect(textOf(tree)).toBe("before  after");
  });

  it("removes a line-start block comment whole", () => {
    const tree = process("%%\ncomment\n%%\n\nvisible");

    expect(tree.children).toHaveLength(1);
    expect(textOf(tree)).toBe("visible");
  });

  it("removes a multi-line block comment containing markdown and blank lines", () => {
    const tree = process(
      "%%\n# hidden\n\n**markdown**\n\n- list\n%%\n\nvisible",
    );

    expect(tree.children).toHaveLength(1);
    expect(textOf(tree)).toBe("visible");
  });

  it("hides the rest of the note after an unclosed inline comment", () => {
    const tree = process("visible %% hidden\n\n# also hidden\n\nmore");

    expect(tree.children).toHaveLength(1);
    expect(textOf(tree)).toBe("visible ");
  });

  it("hides the rest of the note after an unclosed block comment", () => {
    const tree = process("%% hidden\n\n# also hidden\n\nmore");

    expect(tree.children).toHaveLength(0);
  });

  it("leaves comments inside code alone", () => {
    const tree = process("`a %% b`\n\n```\n%%\n```");

    expect(JSON.stringify(tree)).toContain("a %% b");
    expect(JSON.stringify(tree)).toContain('"value":"%%"');
  });

  it("removes comments through the per-feature plugin", () => {
    const tree = processStandalone("before %%hidden%% after");

    expect(textOf(tree)).toBe("before  after");
  });
});
