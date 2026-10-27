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

declare module "micromark-util-types" {
  interface TokenTypeMap {
    obsidianFootnote: "obsidianFootnote";
  }
}

/**
 * Intermediate node for `^[text]`. It never reaches the output; the transform
 * turns it into text carrying `hName: "sup"`.
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
      node.value = this.sliceSerialize(token).slice(2, -1);
      this.exit(token);
    },
  },
};

export function configureFootnotes(processor: Processor): (tree: Root) => void {
  addExtension(processor, "micromarkExtensions", footnoteSyntax);
  addExtension(processor, "fromMarkdownExtensions", footnoteFromMarkdown);

  return (tree) => {
    visit(tree, "obsidianFootnote", (node, index, parent) => {
      if (index === undefined || !parent) return;
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
