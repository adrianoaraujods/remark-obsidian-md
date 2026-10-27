import type { Literal, Node, Parent, Root, Text } from "mdast";
import type {
  CompileContext,
  Extension as FromMarkdownExtension,
  Token,
} from "mdast-util-from-markdown";
import { codes } from "micromark-util-symbol";
import type {
  Code,
  Construct,
  Effects,
  Extension as MicromarkExtension,
  State,
  TokenizeContext,
} from "micromark-util-types";
import type { Processor, Transformer } from "unified";
import { SKIP, visit } from "unist-util-visit";

import { addExtension } from "./extensions.js";
import { isLineEnding } from "./utils.js";

declare module "micromark-util-types" {
  interface TokenTypeMap {
    obsidianComment: "obsidianComment";
  }
}

/**
 * Intermediate node for an inline `%%…%%`. It never reaches the output: a
 * closed comment is dropped, an unclosed one hides the rest of the Note.
 */
interface ObsidianCommentNode extends Literal {
  type: "obsidianComment";
  data?: { obsidianCommentUnclosed?: boolean };
}

declare module "mdast" {
  interface PhrasingContentMap {
    obsidianComment: ObsidianCommentNode;
  }

  interface RootContentMap {
    obsidianComment: ObsidianCommentNode;
  }
}

/**
 * Micromark inline token for `%%…%%`. A line-start `%%` is left to the block
 * transform; everything else is an inline comment.
 */
const comment: Construct = {
  name: "obsidianComment",
  tokenize: tokenizeComment,
};

export const commentSyntax: MicromarkExtension = {
  text: { [codes.percentSign]: comment },
};

function tokenizeComment(
  this: TokenizeContext,
  effects: Effects,
  ok: State,
  nok: State,
): State {
  const self = this;
  return start;

  function start(code: Code): State | undefined {
    if (code !== codes.percentSign) return nok(code);
    // A block comment starts at the beginning of a line; the MDAST transform
    // owns it because it can span blank lines and markdown blocks. The second
    // `%` of that opener must also be skipped.
    if (self.now().column === 1) return nok(code);
    if (self.now().column === 2 && self.previous === codes.percentSign) {
      return nok(code);
    }

    effects.enter("obsidianComment");
    effects.consume(code);
    return second;
  }

  function second(code: Code): State | undefined {
    if (code !== codes.percentSign) return nok(code);
    effects.consume(code);
    return inside;
  }

  function inside(code: Code): State | undefined {
    // End of the line or Note without a closing `%%`: the comment is unclosed
    // and hides the rest of the Note. The line ending itself is left to core.
    // ponytail: single-line only; a multi-line inline Comment is treated as
    // unclosed. Block comments cover the multi-line case.
    if (code === codes.eof || isLineEnding(code)) {
      effects.exit("obsidianComment");
      return ok(code);
    }
    if (code === codes.percentSign) {
      effects.consume(code);
      return closing;
    }
    effects.consume(code);
    return inside;
  }

  function closing(code: Code): State | undefined {
    if (code === codes.percentSign) {
      effects.consume(code);
      effects.exit("obsidianComment");
      return ok;
    }
    return inside(code);
  }
}

export const commentFromMarkdown: FromMarkdownExtension = {
  enter: {
    obsidianComment(this: CompileContext, token: Token) {
      this.enter({ type: "obsidianComment", value: "" }, token);
    },
  },
  exit: {
    obsidianComment(this: CompileContext, token: Token) {
      const node = this.stack[this.stack.length - 1] as ObsidianCommentNode;
      const raw = this.sliceSerialize(token);
      node.value = raw;
      if (!isClosed(raw)) {
        node.data = { obsidianCommentUnclosed: true };
      }
      this.exit(token);
    },
  },
};

function isClosed(raw: string): boolean {
  return raw.length >= 4 && raw.endsWith("%%");
}

type Range = { start: number; end: number };

/**
 * A node that carries children: an mdast parent, or a Footnote container.
 * The Footnote holds phrasing content, which mdast counts as root content
 * too.
 */
function hasChildren(node: Node): node is Parent {
  return "children" in node;
}

export function configureComments(processor: Processor): (tree: Root) => void {
  addExtension(processor, "micromarkExtensions", commentSyntax);
  addExtension(processor, "fromMarkdownExtensions", commentFromMarkdown);

  return (tree) => {
    processComments(tree);
  };
}

export function remarkObsidianComments(this: Processor): Transformer<Root> {
  return configureComments(this);
}

/**
 * Comments are processed per document scope: the Note itself, and separately
 * every Embed's embedded content, whose positions come from another
 * document and must not be mixed with the outer offsets.
 */
function processComments(parent: Parent): void {
  removeBlockComments(parent);
  removeComments(parent);

  for (const embed of collectEmbeds(parent)) {
    processComments(embed);
  }
}

function collectEmbeds(parent: Parent): Parent[] {
  const embeds: Parent[] = [];

  for (const child of parent.children) {
    if (child.type === "embed") {
      embeds.push(child);
    } else if (hasChildren(child)) {
      embeds.push(...collectEmbeds(child));
    }
  }

  return embeds;
}

/**
 * A line-start `%%…%%` block, including blank lines and markdown, is removed
 * whole. The closing delimiter is the next literal `%%` after the opener; a
 * block with no closer runs to the end of the Note.
 */
function removeBlockComments(parent: Parent): void {
  const ranges = blockCommentRanges(parent);
  if (ranges.length > 0) removeRanges(parent, ranges);
}

type RawNode = { start: number; column: number; value: string };

function blockCommentRanges(parent: Parent): Range[] {
  const raw: RawNode[] = [];
  let documentEnd = 0;

  visit(parent, (node) => {
    if (node.type === "embed") return SKIP;
    if (node.type !== "text" && node.type !== "obsidianComment") return;
    const start = node.position?.start.offset;
    const column = node.position?.start.column;
    const end = node.position?.end.offset;
    if (start == null || column == null || end == null) return;
    documentEnd = Math.max(documentEnd, end);
    raw.push({
      start,
      column,
      value: (node as Text | ObsidianCommentNode).value,
    });
  });

  const ranges: Range[] = [];

  for (let index = 0; index < raw.length; index++) {
    const opener = raw[index];
    if (!opener) continue;
    if (opener.value[0] !== "%" || opener.value[1] !== "%") continue;
    if (opener.column !== 1) continue;

    let end = documentEnd;
    for (let next = index; next < raw.length; next++) {
      const candidate = raw[next];
      if (!candidate) continue;
      const from = next === index ? 2 : 0;
      const close = candidate.value.indexOf("%%", from);
      if (close === -1) continue;
      end = candidate.start + close + 2;
      index = next;
      break;
    }

    ranges.push({ start: opener.start, end });
    if (end === documentEnd) break;
  }

  return ranges;
}

function removeRanges(parent: Parent, ranges: Range[]): void {
  for (let index = parent.children.length - 1; index >= 0; index--) {
    const child = parent.children[index];
    if (!child) continue;

    const start = child.position?.start.offset;
    const end = child.position?.end.offset;
    if (start == null || end == null) continue;

    const range = ranges.find((r) => start < r.end && end > r.start);
    if (!range) continue;

    const inside = start >= range.start && end <= range.end;

    // An Embed's own position belongs to the outer document, so it can be
    // removed by an outer range — but its children never are: they carry the
    // embedded Note's offsets and are processed as their own scope.
    if (child.type === "embed") {
      if (inside) parent.children.splice(index, 1);
      continue;
    }

    if (inside) {
      parent.children.splice(index, 1);
      continue;
    }

    if (child.type === "text" || child.type === "obsidianComment") {
      const value = trimValue(child, range);
      if (!value) {
        parent.children.splice(index, 1);
      } else if (child.type === "text") {
        child.value = value;
      } else {
        // A comment token straddling the block's closing `%%` keeps its
        // trailing text; the delimiter itself is inside the range.
        parent.children[index] = { type: "text", value };
      }
      continue;
    }

    if (hasChildren(child)) {
      removeRanges(child, ranges);
      if (child.children.length === 0) parent.children.splice(index, 1);
    }
  }
}

function trimValue(node: Text | ObsidianCommentNode, range: Range): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start == null || end == null) return node.value;

  const before =
    start < range.start ? node.value.slice(0, range.start - start) : "";
  const after = end > range.end ? node.value.slice(range.end - start) : "";
  return before + after;
}

function removeComments(parent: Parent): boolean {
  for (let index = 0; index < parent.children.length; index++) {
    const child = parent.children[index];
    if (!child) continue;

    if (child.type === "obsidianComment") {
      if (child.data?.obsidianCommentUnclosed) {
        parent.children.splice(index);
        return true;
      }
      parent.children.splice(index, 1);
      index--;
      continue;
    }

    if (child.type === "embed") continue;

    if (hasChildren(child) && removeComments(child)) {
      parent.children.splice(child.children.length === 0 ? index : index + 1);
      return true;
    }
  }

  return false;
}
