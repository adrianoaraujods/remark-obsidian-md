/** biome-ignore-all lint/suspicious/noExplicitAny: checking for values outside declared types */
import fs from "node:fs";
import path from "node:path";
import type { Blockquote, Paragraph, Root, Text } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_CALLOUTS, processCallouts } from "../src/callouts";
import { DEFAULT_OPTIONS } from "../src/types";

const FIXTURES_DIR = "tests/fixtures";
const MARKDOWN_TEST_FILE_NAME = "Callouts.md";

describe("processCallouts", () => {
  let tree: Root;

  beforeAll(() => {
    const fixturePath = path.join(
      process.cwd(),
      `${FIXTURES_DIR}/${MARKDOWN_TEST_FILE_NAME}`,
    );

    const markdownContent = fs.readFileSync(fixturePath, "utf-8");

    const processor = unified().use(remarkParse);
    tree = processor.parse(markdownContent);

    processCallouts(tree, { ...DEFAULT_OPTIONS, callouts: DEFAULT_CALLOUTS });
  });

  // Helper to get the n-th blockquote from the root
  function getBlockquote(index: number) {
    const blockquotes = tree.children.filter(
      (node): node is Blockquote => node.type === "blockquote",
    );

    return blockquotes[index];
  }

  // Helper to safely extract title text from the generated title node
  function getTitleText(node: Blockquote) {
    const titleNode = node.children[0] as Paragraph;
    const textNode = titleNode.children.find((c) => c.type === "text");
    return textNode?.value?.trim();
  }

  // 1st Blockquote: `> Quote`
  it("should ignore standard blockquotes", () => {
    const node = getBlockquote(0);
    expect(node.data).toBeUndefined();

    // Verify content wasn't shifted (Title node shouldn't exist)
    const firstParagraph = node.children[0] as Paragraph;
    const firstText = firstParagraph.children[0] as unknown as Text;
    expect(firstText.value).toContain("Quote");
  });

  // 2nd Blockquote: > [!info] Title
  it("should transform callouts with custom titles", () => {
    const node = getBlockquote(1);

    expect((node.data as any).hName).toBe("div");
    expect((node.data as any).hProperties?.className).toContain("callout");
    expect((node.data as any).hProperties?.["data-callout"]).toBe("info");

    const titleText = getTitleText(node);
    expect(titleText).toBe("Title");
  });

  it("should handle rich text in titles (Bold, Italic, Math)", () => {
    const node = getBlockquote(2);
    expect(node).toBeDefined();

    const titleNode = node.children[0] as Paragraph;

    const childTypes = titleNode.children.map((c) => c.type);
    const childValues = titleNode.children
      .filter((c) => c.type === "text")
      .map((c) => (c as Text).value);

    expect(childValues).toContain(" Normal ");
    expect(childTypes).toContain("strong");
    expect(childTypes).toContain("emphasis");
  });

  it("should handle default titles (auto-capitalization)", () => {
    // 4th Blockquote: > [!info] (No title)
    const node = getBlockquote(3);

    const titleText = getTitleText(node);
    expect(titleText).toBe("Info");
  });

  // 5th Blockquote: `> [!info] Callout without content.`
  it("should handle empty content bodies", () => {
    const node = getBlockquote(3);

    // 2 children = icon + title
    expect(node.children).toHaveLength(2);
  });

  it("should transform collapsible callouts (closed)", () => {
    const node = tree.children.find(
      (n) =>
        n.type === "blockquote" &&
        (n.children[0] as any)?.children?.some((c: any) =>
          c.value?.includes("Collapsible Callout (closed)"),
        ),
    ) as Blockquote;

    expect((node.data as any).hName).toBe("details");
    expect((node.data as any).hProperties.open).toBe(false);

    // Title should be a <summary>
    const titleNode = node.children[0];

    expect((titleNode.data as any)?.hName).toBe("summary");
  });

  it("should transform collapsible callouts (open)", () => {
    // > [!info]+
    const node = tree.children.find(
      (n) =>
        n.type === "blockquote" &&
        (n.children[0] as any)?.children?.some((c: any) =>
          c.value?.includes("Collapsible Callout (open)"),
        ),
    ) as Blockquote;

    expect((node.data as any).hName).toBe("details");
    expect((node.data as any).hProperties?.open).toBe(true);
  });

  // > [!undefined]
  it("should handle unknown/undefined types", () => {
    const node = getBlockquote(7);

    expect((node.data as any).hProperties?.["data-callout"]).toBe("undefined");
  });

  it("should handle nested callouts", () => {
    const outerNode = getBlockquote(8);

    expect((outerNode.data as any).hProperties?.["data-callout"]).toBe("note");

    const innerNode = outerNode.children.find(
      (n) => n.type === "blockquote",
    ) as Blockquote;

    expect(innerNode).toBeDefined();
    expect((innerNode.data as any).hProperties?.["data-callout"]).toBe(
      "abstract",
    );
    expect(getTitleText(innerNode)).toBe("Nested Callout");
  });
});
