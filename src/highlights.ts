import type { Literal, Root } from "mdast";
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

import { addExtension } from "./extensions.js";
import { isLineEnding } from "./utils.js";

declare module "micromark-util-types" {
  interface TokenTypeMap {
    obsidianHighlight: "obsidianHighlight";
  }
}

/**
 * Intermediate node for `==…==`. It never reaches the output; the transform
 * turns it into text carrying `hName: "mark"`.
 */
interface ObsidianHighlightNode extends Literal {
  type: "obsidianHighlight";
}

declare module "mdast" {
  interface PhrasingContentMap {
    obsidianHighlight: ObsidianHighlightNode;
  }

  interface RootContentMap {
    obsidianHighlight: ObsidianHighlightNode;
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

export const highlightFromMarkdown: FromMarkdownExtension = {
  enter: {
    obsidianHighlight(this: CompileContext, token: Token) {
      this.enter({ type: "obsidianHighlight", value: "" }, token);
    },
  },
  exit: {
    obsidianHighlight(this: CompileContext, token: Token) {
      const node = this.stack[this.stack.length - 1] as ObsidianHighlightNode;
      node.value = this.sliceSerialize(token);
      this.exit(token);
    },
  },
};

// Obsidian highlight colours are written as a coloured circle at the start of
// the highlight. They are a plugin convention, not part of the core syntax.
const COLOR_EMOJI =
  /^(?:🔴|🟠|🟡|🟢|🔵|🟣|🟤|⚫|⚪|🟥|🟧|🟨|🟩|🟦|🟪|🟫|⬛|⬜)/u;

export function configureHighlights(
  processor: Processor,
): (tree: Root) => void {
  addExtension(processor, "micromarkExtensions", highlightSyntax);
  addExtension(processor, "fromMarkdownExtensions", highlightFromMarkdown);

  return transformHighlights;
}

/** Rewrites `obsidianHighlight` nodes to text carrying `hName: "mark"`. */
export function transformHighlights(tree: Root): void {
  visit(tree, "obsidianHighlight", (node, index, parent) => {
    if (index === undefined || !parent) return;

    const inner = node.value.slice(2, -2);
    parent.children[index] = COLOR_EMOJI.test(inner)
      ? { type: "text", value: node.value }
      : { type: "text", value: inner, data: { hName: "mark" } };
  });
}

export function remarkObsidianHighlights(this: Processor): Transformer<Root> {
  return configureHighlights(this);
}
