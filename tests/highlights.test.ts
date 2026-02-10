/** biome-ignore-all lint/suspicious/noExplicitAny: the nodes could have custom properties */

import fs from "node:fs";
import path from "node:path";
import type { Paragraph } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { selectAll } from "unist-util-select";
import { describe, expect, it } from "vitest";
import { processHighlights } from "../src/highlights";

const FIXTURES_DIR = "tests/fixtures";
const MARKDOWN_TEST_FILE_NAME = "Highlights.md";

describe("processHighlights", async () => {
  const fixturePath = path.join(
    process.cwd(),
    `${FIXTURES_DIR}/${MARKDOWN_TEST_FILE_NAME}`,
  );

  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture file not found: ${fixturePath}`);
  }

  const markdownContent = fs.readFileSync(fixturePath, "utf-8");
  const processor = unified().use(remarkParse);
  const tree = processor.parse(markdownContent);

  processHighlights(tree, {});

  it("handles highlights correctly within a full paragraph", () => {
    const paragraph = selectAll("paragraph", tree)[1] as Paragraph;
    const markNode = paragraph.children[0];

    expect(markNode.type).toBe("text");
    expect((markNode.data as any).hName).toBe("mark");
  });

  it("handles highlights mixed with normal text", () => {
    const mixedParagraph = selectAll("paragraph", tree)[3] as Paragraph;
    expect(mixedParagraph.children).toHaveLength(3);

    const [before, mark, after] = mixedParagraph.children;

    // Check pre-text
    expect(before.type).toBe("text");
    expect(before.data).toBeUndefined();

    // Check highlight
    expect(mark.type).toBe("text");
    expect((mark as any).value).toBe("Highlighted text");
    expect((mark.data as any).hName).toBe("mark");

    // Check post-text
    expect(after.type).toBe("text");
    expect((after as any).value).toBe(" inside a paragraph.");
  });
});
