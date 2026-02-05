// tests/wiki-links-processing.test.ts

import fs from "node:fs";
import path from "node:path";
import type { Code, InlineCode, Link, Paragraph, Text } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { select, selectAll } from "unist-util-select";
import { describe, expect, it } from "vitest";
import { type Options, transformTree } from "../src";
import { getContentMap } from "../src/content-map";
import { DEFAULT_OPTIONS } from "../src/types";
import { processWikiLinks } from "../src/wiki-links";

const FIXTURES_DIR = "tests/fixtures";
const MARKDOWN_TEST_FILE_NAME = "Wiki Links.md";

describe("processWikiLinks", async () => {
  // 1. Read the real file from disk
  const fixturePath = path.join(
    process.cwd(),
    `${FIXTURES_DIR}/${MARKDOWN_TEST_FILE_NAME}`,
  );
  const markdownContent = fs.readFileSync(fixturePath, "utf-8");

  // 2. Setup a ContentMap manually to match the links in the fixture.
  // We do this to ensure the links resolve successfully during the transformation.
  const contentMap = await getContentMap("./tests/fixtures");

  const options: Required<Options> = {
    ...DEFAULT_OPTIONS,
    contentMap,
  };

  // 3. Setup the Unified Processor
  const processor = unified().use(remarkParse);

  // 4. Parse and Transform
  const tree = processor.parse(markdownContent);

  processWikiLinks(processor, tree, options);

  it("should transform links in Headings", () => {
    // # Heading with [[Wiki Link]]
    const heading = select("heading", tree);
    const link = select("link", heading as any) as Link;

    expect(link).toBeDefined();
    expect(link.url).toBe("/wiki-link");
    expect((link.children[0] as Text).value).toBe("Wiki Link");
  });

  it("should transform standalone WikiLinks", () => {
    // [[Wiki Link]]
    // Find paragraph that has exactly one child which is a link
    const paragraphs = selectAll("paragraph", tree);
    const standaloneLink = paragraphs.find(
      (p) =>
        (p as Paragraph).children.length === 1 &&
        (p as Paragraph).children[0].type === "link",
    ) as Paragraph;

    const link = standaloneLink?.children[0] as Link;
    expect(link).toBeDefined();
    expect(link.url).toBe("/wiki-link");
  });

  it("should transform inline WikiLinks in text", () => {
    // Paragraph with [[Wiki Link]].
    const links = selectAll("paragraph > link", tree) as Link[];
    const simpleLink = links.find((l) => l.url === "/wiki-link");

    expect(simpleLink).toBeDefined();
  });

  it("should handle aliased links (piped)", () => {
    // [[Nested|Nested Wiki Link]]
    const links = selectAll("link", tree) as Link[];
    const aliasedLink = links.find((l) => l.url === "/folder/nested");

    expect(aliasedLink).toBeDefined();
    expect((aliasedLink!.children[0] as Text).value).toBe("Nested Wiki Link");
  });

  it("should transform links inside Bold/Strong", () => {
    // **[[Wiki Link]]**
    const strong = select("strong", tree);
    const link = select("link", strong as any) as Link;

    expect(link).toBeDefined();
    expect(link.url).toBe("/wiki-link");
  });

  it("should transform links inside Italic/Emphasis", () => {
    // _[[Wiki Link]]_
    const emphasis = select("emphasis", tree);
    const link = select("link", emphasis as any) as Link;

    expect(link).toBeDefined();
    expect(link.url).toBe("/wiki-link");
  });

  it("should transform links inside Bold AND Italic", () => {
    // **_[[Wiki Link]]_**
    const link = select("strong emphasis link", tree) as Link;

    expect(link).toBeDefined();
    expect(link.url).toBe("/wiki-link");
  });

  it("should NOT transform links inside Inline Code", () => {
    // `[[Wiki Link]]`
    const inlineCode = select("inlineCode", tree) as InlineCode;

    expect(inlineCode).toBeDefined();
    expect(inlineCode.value).toBe("[[Wiki Link]]");

    // InlineCode nodes are leaves, they should not have children
    const children = (inlineCode as any).children;
    expect(children).toBeUndefined();
  });

  it("should transform links inside Lists", () => {
    // - Unordered List with [[Wiki Link]]
    const listItems = selectAll("listItem", tree);
    const linkInList = select("link", {
      type: "root",
      children: listItems,
    } as any) as Link;

    expect(linkInList).toBeDefined();
    expect(linkInList.url).toBe("/wiki-link");
  });

  it("should NOT transform links inside Code Blocks", () => {
    // ``` ... ```
    const codeBlock = select("code", tree) as Code;

    expect(codeBlock).toBeDefined();
    expect(codeBlock.value).toContain("[[Wiki Link]]");
  });
});
