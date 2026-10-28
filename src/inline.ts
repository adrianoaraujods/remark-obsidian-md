import type { Node, PhrasingContent } from "mdast";
import type {
  Extension as FromMarkdownExtension,
  Token,
} from "mdast-util-from-markdown";
import { fromMarkdown } from "mdast-util-from-markdown";
import type { Extension as MicromarkExtension } from "micromark-util-types";
import type { Processor } from "unified";
import type { Position } from "unist";
import { visit } from "unist-util-visit";

/**
 * Parses a construct's content as inline Markdown with the extensions the
 * host pipeline carries, so every inline construct the Note supports works
 * inside it.
 *
 * The extensions the caller excludes are left out: a construct that excludes
 * itself keeps from nesting, and the Embed — a block construct — stays
 * literal.
 *
 * The content is inline only when it parses as a single paragraph; anything
 * else (a heading, a list) is block Markdown and stays literal text.
 * ponytail: inline content only; parse the content as a document and take its
 * phrasing children when block content is wanted.
 */
export function parseInlineContent(
  content: string,
  processor: Processor,
  exclude: readonly MicromarkExtension[],
): PhrasingContent[] | undefined {
  const data = processor.data() as Record<string, unknown>;
  const extensions = (
    (data.micromarkExtensions as MicromarkExtension[] | undefined) ?? []
  ).filter((extension) => !exclude.includes(extension));
  const mdastExtensions =
    (data.fromMarkdownExtensions as FromMarkdownExtension[] | undefined) ?? [];

  // A `%%` at the start of a line opens a block Comment; the space makes it
  // open an inline one instead. The space is dropped by the parse.
  const source = content.startsWith("%%") ? ` ${content}` : content;

  const tree = fromMarkdown(source, {
    extensions,
    mdastExtensions,
  });

  if (tree.children.length === 0) return [];
  if (tree.children.length !== 1) return undefined;

  const [child] = tree.children;
  if (child?.type !== "paragraph") return undefined;

  return child.children;
}

/** Whether the phrasing content is plain text. */
export function isPlainText(children: PhrasingContent[]): boolean {
  return children.every((child) => child.type === "text");
}

/**
 * The content range of a construct: `start` and `end` are the deltas from
 * the construct's own start and end — the Footnote's content starts after
 * `^[` and ends before `]`, the Highlight's after `==` and before `==`.
 */
export function contentPosition(
  token: Token,
  start: number,
  end: number,
): Position {
  return {
    start: {
      line: token.start.line,
      column: token.start.column + start,
      offset: token.start.offset + start,
    },
    end: {
      line: token.end.line,
      column: token.end.column + end,
      offset: token.end.offset + end,
    },
  };
}

/**
 * Points every descendant of a construct at its content range: the nested
 * parse's own positions are relative to it.
 * ponytail: no per-node positions inside a Footnote or a Highlight; offset the
 * nested parse's positions by the content's start offset.
 */
export function applyContentPosition(node: Node, position: Position): void {
  visit(node, (child) => {
    if (child === node) return;
    child.position = position;
  });
}
