import type { Paragraph, Root } from "mdast";
import { visit } from "unist-util-visit";

export const MAX_EMBED_DEPTH = 4;

type IncludeNode = {
  type: "mdxJsxTextElement";
  name: "include";
  data: { tree: Root };
};

export function processEmbeds(tree: Root) {
  // Post-Processing: Flatten `<include>` nodes
  visit(tree, "paragraph", (node: Paragraph, index, parent) => {
    if (!parent || typeof index !== "number") return;

    if (node.children.length === 1) {
      const child = node.children[0] as unknown as IncludeNode;

      if (child.type === "mdxJsxTextElement" && child.name === "include") {
        const embedTree = child.data?.tree;

        if (embedTree) {
          parent.children.splice(index, 1, ...embedTree.children);
          return index + embedTree.children.length;
        }
      }
    }
  });
}
