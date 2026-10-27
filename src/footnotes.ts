import type { Literal, Parent, PhrasingContent, Root } from "mdast";
import type {
  CompileContext,
  Extension as FromMarkdownExtension,
  Token,
} from "mdast-util-from-markdown";
import { fromMarkdown } from "mdast-util-from-markdown";
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
import type { Position } from "unist";
import { visit } from "unist-util-visit";

import { addExtension } from "./extensions.js";

declare module "micromark-util-types" {
  interface TokenTypeMap {
    obsidianFootnote: "obsidianFootnote";
  }
}

/**
 * Intermediate node for `^[text]`. It never reaches the output: a Footnote
 * whose content holds elements becomes a parent carrying the parsed content,
 * and a Footnote whose content is plain text becomes a text node carrying
 * `hName: "sup"`.
 */
interface ObsidianFootnoteNode extends Literal {
  type: "obsidianFootnote";
}

declare module "mdast" {
  interface PhrasingContentMap {
    obsidianFootnote: ObsidianFootnoteNode;
  }

  interface RootContentMap {
    obsidianFootnote: ObsidianFootnoteNode;
  }
}

/** Micromark inline token for `^[text]`. */
const footnote: Construct = {
  name: "obsidianFootnote",
  tokenize: tokenizeFootnote,
};

export const footnoteSyntax: MicromarkExtension = {
  text: { [codes.caret]: footnote },
};

function tokenizeFootnote(
  this: TokenizeContext,
  effects: Effects,
  ok: State,
  nok: State,
): State {
  // The opening `[` counts as one, so the Footnote closes at the `]` that
  // matches it and a bracketed fragment inside does not end it early.
  let depth = 1;
  return start;

  function start(code: Code): State | undefined {
    if (code !== codes.caret) return nok(code);
    effects.enter("obsidianFootnote");
    effects.consume(code);
    return open;
  }

  function open(code: Code): State | undefined {
    if (code !== codes.leftSquareBracket) return nok(code);
    effects.consume(code);
    return inside;
  }

  function inside(code: Code): State | undefined {
    if (
      code === codes.eof ||
      code === codes.lineFeed ||
      code === codes.carriageReturn ||
      code === codes.carriageReturnLineFeed
    ) {
      return nok(code);
    }

    if (code === codes.leftSquareBracket) {
      depth++;
      effects.consume(code);
      return inside;
    }

    if (code === codes.rightSquareBracket) {
      depth--;
      effects.consume(code);
      if (depth > 0) return inside;
      effects.exit("obsidianFootnote");
      return ok;
    }

    effects.consume(code);
    return inside;
  }
}

export const footnoteFromMarkdown: FromMarkdownExtension = {
  enter: {
    obsidianFootnote(this: CompileContext, token: Token) {
      this.enter({ type: "obsidianFootnote", value: "" }, token);
    },
  },
  exit: {
    obsidianFootnote(this: CompileContext, token: Token) {
      const node = this.stack[this.stack.length - 1] as ObsidianFootnoteNode;
      const content = this.sliceSerialize(token).slice(2, -1);
      node.value = content;

      const children = parseContent(content);

      // Plain text keeps publishing as a text node; content that holds
      // elements becomes a parent carrying the parsed content.
      if (children && !isPlainText(children)) {
        const container = node as ObsidianFootnoteNode & Parent;
        container.children = children;
        container.data = { hName: "sup", hProperties: {} };

        // Every node of the parsed content points at the Footnote's content
        // range: the nested parse's own positions are relative to it.
        visit(container, (child) => {
          if (child === container) return;
          child.position = contentPosition(token);
        });
      }

      this.exit(token);
    },
  },
};

/**
 * Parses a Footnote's content as inline Markdown. The content is inline only
 * when it parses as a single paragraph; anything else (a heading, a list) is
 * block Markdown and stays literal text.
 *
 * ponytail: core Markdown only; the Note's own syntax extensions arrive with
 * ticket #20, which parses the content with the processor's extensions.
 */
function parseContent(content: string): PhrasingContent[] | undefined {
  const tree = fromMarkdown(content);

  if (tree.children.length === 0) return [];
  if (tree.children.length !== 1) return undefined;

  const [child] = tree.children;
  if (child?.type !== "paragraph") return undefined;

  return child.children;
}

/** Whether the phrasing content is plain text. */
function isPlainText(children: PhrasingContent[]): boolean {
  return children.every((child) => child.type === "text");
}

/** The Footnote's content range: between `^[` and the closing `]`. */
function contentPosition(token: Token): Position {
  return {
    start: {
      line: token.start.line,
      column: token.start.column + 2,
      offset: token.start.offset + 2,
    },
    end: {
      line: token.end.line,
      column: token.end.column - 1,
      offset: token.end.offset - 1,
    },
  };
}

export function configureFootnotes(processor: Processor): (tree: Root) => void {
  addExtension(processor, "micromarkExtensions", footnoteSyntax);
  addExtension(processor, "fromMarkdownExtensions", footnoteFromMarkdown);

  return (tree) => {
    visit(tree, "obsidianFootnote", (node, index, parent) => {
      if (index === undefined || !parent) return;

      // A Footnote holding parsed content is already a container; only a
      // Footnote of plain text becomes a text node.
      if ("children" in node) return;

      parent.children[index] = {
        type: "text",
        value: node.value,
        data: { hName: "sup" },
      };
    });
  };
}

export function remarkObsidianFootnotes(this: Processor): Transformer<Root> {
  return configureFootnotes(this);
}
