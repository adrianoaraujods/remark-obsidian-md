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
  textOf,
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

  let currentAnchors: Set<string> | undefined;
  const anchorsOf = (): Set<string> => {
    currentAnchors ??= headingAnchors(tree, context.slugger);
    return currentAnchors;
  };

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
      parent.children[index] = parsed.subpath
        ? subpathResolves(parsed.subpath, context, undefined, anchorsOf)
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
      subpathResolves(parsed.subpath, context, resolved.path, anchorsOf)
    ) {
      parent.children[index] = {
        type: "link",
        url: slugifyUrl(resolved.path, {
          slugify: context.slugify,
          slugifyPath: context.slugifyPath,
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
 * A Subpath only resolves when its target can be found: a Heading in the
 * current Note's tree, or a Heading or Block ID in the target Note's
 * markdown. Without an index or a reader there is nothing to check
 * against, so the link is kept.
 */
function subpathResolves(
  subpath: ParsedSubpath | undefined,
  context: WikiLinkContext,
  notePath: string | undefined,
  currentAnchors: () => Set<string>,
): boolean {
  if (!subpath) return true;

  if (subpath.kind === "blockId") {
    if (!context.blockIds) return true;

    if (notePath === undefined) {
      return context.blockIds.current.has(subpath.value);
    }

    const body = context.blockIds.readNote?.(notePath);
    return body === undefined || scanBlockIds(body).has(subpath.value);
  }

  // A Heading Subpath validates against the current tree, or against the
  // target Note's markdown when a reader is available.
  if (notePath === undefined) {
    return currentAnchors().has(context.slugger(subpath.value));
  }

  const body = context.blockIds?.readNote?.(notePath);
  return (
    body === undefined ||
    scanHeadingAnchors(body, context.slugger).has(
      context.slugger(subpath.value),
    )
  );
}

/** Collects the heading anchors of the current Note's tree. */
function headingAnchors(
  tree: Root,
  slugger: (text: string) => string,
): Set<string> {
  const anchors = new Set<string>();
  visit(tree, "heading", (node) => {
    anchors.add(slugger(textOf(node)));
  });
  return anchors;
}

const HEADING_LINE = /^#{1,6}\s+(.+?)\s*$/;

/**
 * Collects a Note's heading anchors from raw markdown, for cross-Note
 * Subpaths.
 * ponytail: ATX headings only; setext headings (`Title` over `===`) need a
 * full parse — add when a Vault actually uses them.
 */
function scanHeadingAnchors(
  markdown: string,
  slugger: (text: string) => string,
): Set<string> {
  const anchors = new Set<string>();

  for (const line of markdown.split(/\r?\n/)) {
    const match = HEADING_LINE.exec(line);
    if (match?.[1]) anchors.add(slugger(match[1]));
  }

  return anchors;
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

/** The label a Wiki Link displays: its Alias, target name or Subpath. */
export function aliasOrTarget(parsed: ParsedWikiLink) {
  return (
    parsed.alias || parsed.target || parsed.subpaths.at(-1) || parsed.rawTarget
  );
}

function literal(node: WikiLinkNode) {
  return { type: "text" as const, value: `[[${node.value}]]` };
}

/** Builds the default WikiLinkContext from a plugin's options. */
export function defaultWikiLinkContext(
  options: WikiLinksPluginOptions = {},
): WikiLinkContext {
  return {
    resolver: options.resolver ?? mapResolver({}),
    slugger: options.slugger ?? githubSlugger,
    slugify: options.slugify ?? slugify,
    slugifyPath: options.slugifyPath,
    urlPrefix: options.urlPrefix ?? "",
    unresolvedStrategy: options.unresolvedStrategy ?? "link",
  };
}

export function configureWikiLinks(
  processor: Processor,
  options: WikiLinksPluginOptions,
): WikiLinkContext {
  addExtension(processor, "micromarkExtensions", wikiLinkSyntax);
  addExtension(processor, "fromMarkdownExtensions", wikiLinkFromMarkdown);

  return defaultWikiLinkContext(options);
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
