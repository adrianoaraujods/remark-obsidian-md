import type { Root } from "mdast";
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
import { visit } from "unist-util-visit";

import { embedSyntax } from "./embed.js";
import { addExtension } from "./extensions.js";
import {
  applyContentPosition,
  contentPosition,
  isPlainText,
  parseInlineContent,
} from "./inline.js";
import type { ObsidianHighlightNode } from "./types.js";
import { isLineEnding } from "./utils.js";

declare module "micromark-util-types" {
  interface TokenTypeMap {
    obsidianHighlight: "obsidianHighlight";
  }
}

/** Micromark inline token for `==…==`. */
const highlight: Construct = {
  name: "obsidianHighlight",
  tokenize: tokenizeHighlight,
};

export const highlightSyntax: MicromarkExtension = {
  text: { [codes.equalsTo]: highlight },
};

function tokenizeHighlight(
  this: TokenizeContext,
  effects: Effects,
  ok: State,
  nok: State,
): State {
  return start;

  function start(code: Code): State | undefined {
    if (code !== codes.equalsTo) return nok(code);
    effects.enter("obsidianHighlight");
    effects.consume(code);
    return second;
  }

  function second(code: Code): State | undefined {
    if (code !== codes.equalsTo) return nok(code);
    effects.consume(code);
    return inside;
  }

  function inside(code: Code): State | undefined {
    // ponytail: single-line only; a Highlight spanning a line break stays
    // literal. Supporting it needs a resolver-based tokenizer (à la GFM
    // strikethrough), add when a multi-line Highlight is actually needed.
    if (code === codes.eof || isLineEnding(code)) return nok(code);
    if (code === codes.equalsTo) {
      effects.consume(code);
      return closing;
    }
    effects.consume(code);
    return inside;
  }

  function closing(code: Code): State | undefined {
    if (code === codes.equalsTo) {
      effects.consume(code);
      effects.exit("obsidianHighlight");
      return ok;
    }
    return inside(code);
  }
}

export function highlightFromMarkdown(
  processor: Processor,
): FromMarkdownExtension {
  return {
    enter: {
      obsidianHighlight(this: CompileContext, token: Token) {
        this.enter({ type: "obsidianHighlight", value: "" }, token);
      },
    },
    exit: {
      obsidianHighlight(this: CompileContext, token: Token) {
        const node = this.stack[this.stack.length - 1] as ObsidianHighlightNode;
        node.value = this.sliceSerialize(token);

        const content = node.value.slice(2, -2);
        const marker = parseColorMarker(content);

        // The Highlight and Embed tokenizers are left out: the first keeps a
        // nested `==` literal, the second keeps an Embed — a block construct
        // — literal.
        const children = parseInlineContent(
          content.slice(marker.length),
          processor,
          [highlightSyntax, embedSyntax],
        );

        // Plain text keeps publishing as a text node; content that holds
        // elements becomes a parent carrying the parsed content.
        if (children && !isPlainText(children)) {
          node.children = children;
          node.data = {
            hName: "mark",
            hProperties: marker.color ? { "data-highlight": marker.color } : {},
          };

          // Every node of the parsed content points at the Highlight's content
          // range: the nested parse's own positions are relative to it. The
          // color marker shifts the range by its own length.
          applyContentPosition(
            node,
            contentPosition(token, 2 + marker.length, -2),
          );
        }

        this.exit(token);
      },
    },
  };
}

/**
 * Obsidian 1.14's Highlight Colors: the twelve emoji it accepts, mapped to
 * the six color names its reading view emits.
 */
const HIGHLIGHT_COLORS: Record<string, string> = {
  "🔴": "red",
  "🟥": "red",
  "🟠": "orange",
  "🟧": "orange",
  "🟡": "yellow",
  "🟨": "yellow",
  "🟢": "green",
  "🟩": "green",
  "🔵": "blue",
  "🟦": "blue",
  "🟣": "purple",
  "🟪": "purple",
};

/**
 * The Highlight Color at the start of a Highlight's content: Obsidian
 * inspects the first code point only, and an emoji outside the map is not a
 * color. The length is the marker's own, so the content range shifts with it.
 */
function parseColorMarker(content: string): { color: string; length: number } {
  const codePoint = content.codePointAt(0);
  const marker = codePoint === undefined ? "" : String.fromCodePoint(codePoint);
  const color = HIGHLIGHT_COLORS[marker] ?? "";
  return { color, length: color ? marker.length : 0 };
}

export function configureHighlights(
  processor: Processor,
): (tree: Root) => void {
  addExtension(processor, "micromarkExtensions", highlightSyntax);
  addExtension(
    processor,
    "fromMarkdownExtensions",
    highlightFromMarkdown(processor),
  );

  return transformHighlights;
}

/**
 * Rewrites `obsidianHighlight` nodes: a Highlight of plain text becomes a text
 * node carrying `hName: "mark"`, and a Highlight holding parsed content stays
 * a container — it already carries `hName: "mark"`. Both carry the Highlight
 * Color the content's first emoji names, if any.
 */
export function transformHighlights(tree: Root): void {
  visit(tree, "obsidianHighlight", (node, index, parent) => {
    if (index === undefined || !parent) return;

    // A Highlight holding parsed content is already a container; only a
    // Highlight of plain text becomes a text node.
    if ("children" in node) return;

    const content = node.value.slice(2, -2);
    const marker = parseColorMarker(content);

    parent.children[index] = {
      type: "text",
      value: content.slice(marker.length),
      data: {
        hName: "mark",
        ...(marker.color
          ? { hProperties: { "data-highlight": marker.color } }
          : {}),
      },
    };
  });
}

export function remarkObsidianHighlights(this: Processor): Transformer<Root> {
  return configureHighlights(this);
}
