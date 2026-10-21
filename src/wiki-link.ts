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
} from "micromark-util-types";
import type { Processor, Transformer } from "unified";
import { visit } from "unist-util-visit";
import { addExtension } from "./extensions.js";
import { mapResolver } from "./resolver.js";
import type {
  WikiLinkContext,
  WikiLinkNode,
  WikiLinksPluginOptions,
} from "./types.js";
import { parseWikiLink, slugify, slugifyUrl } from "./utils.js";

/**
 * Micromark inline token for `[[…]]`. It fires in every phrasing context and
 * is skipped inside code, because code is tokenized by different constructs.
 */
const wikiLink: Construct = { name: "wikiLink", tokenize: tokenizeWikiLink };

export const wikiLinkSyntax: MicromarkExtension = {
  text: { [codes.leftSquareBracket]: wikiLink },
};

function tokenizeWikiLink(effects: Effects, ok: State, nok: State): State {
  return start;

  function start(code: Code): State | undefined {
    if (code !== codes.leftSquareBracket) return nok(code);
    effects.enter("wikiLink");
    effects.consume(code);
    return secondBracket;
  }

  function secondBracket(code: Code): State | undefined {
    if (code !== codes.leftSquareBracket) return nok(code);
    effects.consume(code);
    return inside;
  }

  function inside(code: Code): State | undefined {
    if (
      code === codes.eof ||
      code === codes.lineFeed ||
      code === codes.carriageReturn
    ) {
      return nok(code);
    }

    effects.consume(code);
    if (code !== codes.rightSquareBracket) return inside;

    return closing;
  }

  function closing(code: Code): State | undefined {
    if (code === codes.rightSquareBracket) {
      effects.consume(code);
      effects.exit("wikiLink");
      return ok;
    }

    return inside(code);
  }
}

export const wikiLinkFromMarkdown: FromMarkdownExtension = {
  enter: {
    wikiLink(this: CompileContext, token: Token) {
      this.enter({ type: "wikiLink", value: "" }, token);
    },
  },
  exit: {
    wikiLink(this: CompileContext, token: Token) {
      const node = this.stack[this.stack.length - 1] as WikiLinkNode;
      // Strip the `[[` and `]]` markers.
      node.value = this.sliceSerialize(token).slice(2, -2);
      this.exit(token);
    },
  },
};

export function transformWikiLinks(tree: Root, context: WikiLinkContext): void {
  visit(tree, "wikiLink", (node, index, parent) => {
    if (index === undefined || !parent) return;

    const parsed = parseWikiLink(node.value);

    // Aliases, Subpaths and Embeds belong to later tickets: keep the source
    // literal until a transform understands them.
    if (!parsed || parsed.alias || parsed.anchor) {
      parent.children[index] = { type: "text", value: `[[${node.value}]]` };
      return;
    }

    const label = parsed.rawTarget;
    const resolved = context.resolver.resolve(parsed.target);

    if (resolved.exists && resolved.kind === "note") {
      parent.children[index] = {
        type: "link",
        url: slugifyUrl(resolved.path, {
          slugify: context.slugify,
          urlPrefix: context.urlPrefix,
        }),
        children: [{ type: "text", value: label }],
      };
      return;
    }

    parent.children[index] =
      context.unresolvedStrategy === "plain"
        ? { type: "text", value: label }
        : {
            type: "link",
            url: "#",
            children: [{ type: "text", value: label }],
            data: { hProperties: { className: "is-unresolved" } },
          };
  });
}

export function configureWikiLinks(
  processor: Processor,
  options: WikiLinksPluginOptions,
): WikiLinkContext {
  addExtension(processor, "micromarkExtensions", wikiLinkSyntax);
  addExtension(processor, "fromMarkdownExtensions", wikiLinkFromMarkdown);

  return {
    resolver: options.resolver ?? mapResolver({}),
    slugify: options.slugify ?? slugify,
    urlPrefix: options.urlPrefix ?? "",
    unresolvedStrategy: options.unresolvedStrategy ?? "link",
  };
}

export function remarkObsidianWikiLinks(
  this: Processor,
  options: WikiLinksPluginOptions = {},
): Transformer<Root> {
  const context = configureWikiLinks(this, options);

  return (tree) => {
    transformWikiLinks(tree, context);
  };
}
