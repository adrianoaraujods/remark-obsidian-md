import type { Parent, Root } from "mdast";
import type { Processor, Transformer } from "unified";
import { visit } from "unist-util-visit";

/**
 * A Block ID is a `^id` marker at the end of a block, preceded by whitespace.
 * The charset is limited to letters, digits and hyphens.
 */
const BLOCK_ID = /\s\^([A-Za-z0-9-]+)\s*$/;

/** Blocks keyed by Block ID (without the `^`). */
export type BlockIndex = Map<string, Parent>;

/**
 * Strips every trailing Block ID from the tree, annotates its block with
 * `id="^id"` and returns the resulting index.
 */
export function processBlockIds(tree: Root): BlockIndex {
  const blocks: BlockIndex = new Map();

  visit(tree, (node, _index, parent) => {
    if (
      node.type !== "paragraph" &&
      node.type !== "heading" &&
      node.type !== "tableCell"
    ) {
      return;
    }

    const last = node.children.at(-1);
    if (last?.type !== "text") return;

    const match = BLOCK_ID.exec(last.value);
    if (!match?.[1]) return;

    last.value = last.value.replace(BLOCK_ID, "");

    // A Block ID at the end of a list item names the item, not its paragraph.
    const target =
      node.type === "paragraph" &&
      parent?.type === "listItem" &&
      parent.children.at(-1) === node
        ? parent
        : node;

    annotate(target, `^${match[1]}`);
    blocks.set(match[1], target);
  });

  return blocks;
}

/** Collects the Block IDs in a Note's raw markdown, for cross-Note references. */
export function scanBlockIds(markdown: string): Set<string> {
  const ids = new Set<string>();

  for (const line of markdown.split(/\r?\n/)) {
    const match = BLOCK_ID.exec(line);
    if (match?.[1]) ids.add(match[1]);
  }

  return ids;
}

export function remarkObsidianBlockIds(this: Processor): Transformer<Root> {
  return (tree) => {
    processBlockIds(tree);
  };
}

function annotate(node: Parent, id: string): void {
  const data = node.data as
    | { hProperties?: Record<string, unknown> }
    | undefined;

  node.data = {
    ...data,
    hProperties: { ...data?.hProperties, id },
  };
}
