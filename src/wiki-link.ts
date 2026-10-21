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

import { scanBlockIds } from "./block-id.js";
import { addExtension } from "./extensions.js";
import { mapResolver } from "./resolver.js";
import type {
  WikiLinkContext,
  WikiLinkNode,
  WikiLinksPluginOptions,
} from "./types.js";
import {
  anchorFor,
  githubSlugger,
  type ParsedSubpath,
  type ParsedWikiLink,
  parseWikiLink,
  slugify,
  slugifyUrl,
} from "./utils.js";

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
  literalizeLinkText(tree);

  visit(tree, "wikiLink", (node, index, parent) => {
    if (index === undefined || !parent) return;

    const parsed = parseWikiLink(node.value);
    if (!parsed) {
      parent.children[index] = literal(node);
      return;
    }

    const label = aliasOrTarget(parsed);
    const anchor = anchorFor(parsed.subpath, context.slugger);

    // A same-Note Subpath (`[[#Heading]]`) only ever needs the fragment.
    if (!parsed.target) {
      parent.children[index] = anchor
        ? blockReferenceResolves(parsed.subpath, context)
          ? {
              type: "link",
              url: `#${anchor}`,
              children: [{ type: "text", value: label }],
            }
          : unresolved(label, context)
        : literal(node);
      return;
    }

    const resolved = context.resolver.resolve(parsed.target);

    if (
      resolved.exists &&
      resolved.kind === "note" &&
      blockReferenceResolves(parsed.subpath, context, resolved.path)
    ) {
      parent.children[index] = {
        type: "link",
        url: slugifyUrl(resolved.path, {
          slugify: context.slugify,
          urlPrefix: context.urlPrefix,
          ...(anchor ? { anchor } : {}),
        }),
        children: [{ type: "text", value: label }],
      };
      return;
    }

    parent.children[index] = unresolved(label, context);
  });
}

/**
 * A Block Reference only resolves when its target Block can be found: in the
 * current Note's index, or in another Note's markdown. Without an index or a
 * reader there is nothing to check against, so the link is kept.
 */
function blockReferenceResolves(
  subpath: ParsedSubpath | undefined,
  context: WikiLinkContext,
  notePath?: string,
): boolean {
  if (subpath?.kind !== "blockId" || !context.blockIds) return true;

  const id = subpath.value;
  if (notePath === undefined) return context.blockIds.current.has(id);

  const body = context.blockIds.readNote?.(notePath);
  return body === undefined || scanBlockIds(body).has(id);
}

function unresolved(label: string, context: WikiLinkContext) {
  return context.unresolvedStrategy === "plain"
    ? { type: "text" as const, value: label }
    : {
        type: "link" as const,
        url: "#",
        children: [{ type: "text" as const, value: label }],
        data: { hProperties: { className: "is-unresolved" } },
      };
}

/**
 * A Wiki Link inside standard link text renders literally, so the output never
 * nests one anchor inside another.
 */
function literalizeLinkText(tree: Root): void {
  visit(tree, ["link", "linkReference"], (link) => {
    visit(link, "wikiLink", (node, index, parent) => {
      if (index !== undefined && parent) parent.children[index] = literal(node);
    });
  });
}

function aliasOrTarget(parsed: ParsedWikiLink) {
  return (
    parsed.alias || parsed.target || parsed.subpaths.at(-1) || parsed.rawTarget
  );
}

function literal(node: WikiLinkNode) {
  return { type: "text" as const, value: `[[${node.value}]]` };
}

export function configureWikiLinks(
  processor: Processor,
  options: WikiLinksPluginOptions,
): WikiLinkContext {
  addExtension(processor, "micromarkExtensions", wikiLinkSyntax);
  addExtension(processor, "fromMarkdownExtensions", wikiLinkFromMarkdown);

  return {
    resolver: options.resolver ?? mapResolver({}),
    slugger: options.slugger ?? githubSlugger,
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
