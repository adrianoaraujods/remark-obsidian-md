import type { Root, RootContent } from "mdast";
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
import remarkParse from "remark-parse";
import { type Processor, type Transformer, unified } from "unified";
import { SKIP, visit } from "unist-util-visit";

import { processHighlights } from "./highlights.js";
import { mapResolver } from "./resolver.js";
import type {
  EmbedNode,
  EmbedsOptions,
  EmbedsPluginOptions,
  WikiLinkContext,
} from "./types.js";
import { githubSlugger, parseWikiLink, slugify } from "./utils.js";
import {
  transformWikiLinks,
  wikiLinkFromMarkdown,
  wikiLinkSyntax,
} from "./wiki-link.js";

/** Micromark inline token for `![[…]]`. */
const embed: Construct = { name: "embed", tokenize: tokenizeEmbed };

export const embedSyntax: MicromarkExtension = {
  text: { [codes.exclamationMark]: embed },
};

function tokenizeEmbed(effects: Effects, ok: State, nok: State): State {
  return start;

  function start(code: Code): State | undefined {
    effects.enter("embed");
    effects.consume(code);
    return open;
  }

  function open(code: Code): State | undefined {
    if (code !== codes.leftSquareBracket) return nok(code);
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
      effects.exit("embed");
      return ok;
    }

    return inside(code);
  }
}

export const embedFromMarkdown: FromMarkdownExtension = {
  enter: {
    embed(this: CompileContext, token: Token) {
      this.enter({ type: "embed", value: "", children: [] }, token);
    },
  },
  exit: {
    embed(this: CompileContext, token: Token) {
      const node = this.stack[this.stack.length - 1] as EmbedNode;
      // Strip the `![[` and `]]` markers.
      node.value = this.sliceSerialize(token).slice(3, -2);
      this.exit(token);
    },
  },
};

type ConfigureEmbedsOptions = EmbedsOptions & {
  wikiLinks: WikiLinkContext;
};

export type EmbedContext = {
  processor: Processor;
  wikiLinks: WikiLinkContext;
  readNote: (path: string) => string | undefined;
  maxDepth: number;
};

type EmbedState = {
  depth: number;
  visited: Set<string>;
};

/** Parents that need a phrasing container; everything else is block. */
const PHRASING_PARENTS = new Set([
  "paragraph",
  "heading",
  "emphasis",
  "strong",
  "delete",
  "link",
  "tableCell",
]);

/**
 * Expands every Embed into its target's parsed content. Whole-Note targets
 * are dispatched here; partial Embeds (#10) and Assets (#11) extend
 * `resolveEmbed` without touching the transclusion engine.
 */
export function transformEmbeds(
  tree: Root,
  context: EmbedContext,
  state: EmbedState = { depth: 0, visited: new Set() },
): void {
  visit(tree, "embed", (node, index, parent) => {
    if (index === undefined || !parent) return;

    parent.children[index] = resolveEmbed(node, context, state);
    // Children were already expanded at the correct depth.
    return SKIP;
  });

  promoteLoneEmbeds(tree);
  annotateContainers(tree);
}

function resolveEmbed(
  node: EmbedNode,
  context: EmbedContext,
  state: EmbedState,
): RootContent {
  const parsed = parseWikiLink(node.value ?? "");

  // Aliases, Subpaths and Assets belong to later tickets: keep the source
  // literal until their transform understands them.
  if (!parsed || parsed.alias || parsed.subpaths.length > 0) {
    return { type: "text", value: `![[${node.value ?? ""}]]` };
  }

  const resolved = context.wikiLinks.resolver.resolve(parsed.target);

  if (!resolved.exists || resolved.kind !== "note") {
    return placeholder(parsed.target);
  }

  const content = context.readNote(resolved.path);

  if (
    content === undefined ||
    state.depth >= context.maxDepth ||
    state.visited.has(resolved.path)
  ) {
    return placeholder(parsed.target);
  }

  return {
    type: "embed",
    data: {
      hProperties: {
        className: ["internal-embed", ...resolved.note.cssclasses],
      },
    },
    children: parseEmbedded(content, context, {
      depth: state.depth + 1,
      visited: new Set([...state.visited, resolved.path]),
    }),
  };
}

function placeholder(target: string): EmbedNode {
  return {
    type: "embed",
    data: {
      hProperties: { className: ["internal-embed", "is-unresolved"] },
    },
    children: [{ type: "text", value: target }],
  };
}

function parseEmbedded(
  markdown: string,
  context: EmbedContext,
  state: EmbedState,
): RootContent[] {
  const processor = unified().use(remarkParse);
  const input = context.processor.data() as Record<string, unknown>;
  const data = processor.data() as Record<string, unknown>;

  // Reuse every inline tokenizer available to the host pipeline (Wiki Link,
  // Embed, and later Comments/Footnotes).
  const micromarkExtensions = [
    ...((input.micromarkExtensions as unknown[] | undefined) ?? []),
  ];
  const fromMarkdownExtensions = [
    ...((input.fromMarkdownExtensions as unknown[] | undefined) ?? []),
  ];

  // Standalone use has no Wiki Link tokenizer on the host pipeline yet, but
  // transcluded content must still resolve its Wiki Links.
  if (!micromarkExtensions.includes(wikiLinkSyntax)) {
    micromarkExtensions.push(wikiLinkSyntax);
  }
  if (!fromMarkdownExtensions.includes(wikiLinkFromMarkdown)) {
    fromMarkdownExtensions.push(wikiLinkFromMarkdown);
  }

  data.micromarkExtensions = micromarkExtensions;
  data.fromMarkdownExtensions = fromMarkdownExtensions;

  const tree = processor.runSync(processor.parse(markdown)) as Root;

  transformWikiLinks(tree, context.wikiLinks);
  transformEmbeds(tree, context, state);
  processHighlights(tree);

  return tree.children;
}

function promoteLoneEmbeds(tree: Root): void {
  visit(tree, "paragraph", (node, index, parent) => {
    if (
      node.children.length !== 1 ||
      node.children[0]?.type !== "embed" ||
      index === undefined ||
      !parent
    ) {
      return;
    }

    parent.children[index] = node.children[0];
  });
}

function annotateContainers(tree: Root): void {
  visit(tree, "embed", (node, _index, parent) => {
    const block = !parent || !PHRASING_PARENTS.has(parent.type);
    const data = (node.data ?? {}) as {
      hProperties?: Record<string, unknown>;
    };

    node.data = {
      ...data,
      hName: block ? "div" : "span",
      hProperties: data.hProperties ?? {},
    };
  });
}

export function configureEmbeds(
  processor: Processor,
  options: ConfigureEmbedsOptions,
): EmbedContext {
  const data = processor.data() as Record<string, unknown>;
  add(data, "micromarkExtensions", embedSyntax);
  add(data, "fromMarkdownExtensions", embedFromMarkdown);

  return {
    processor,
    wikiLinks: options.wikiLinks,
    readNote: options.readNote ?? (() => undefined),
    maxDepth: options.maxDepth ?? 4,
  };
}

export function remarkObsidianEmbeds(
  this: Processor,
  options: EmbedsPluginOptions = {},
): Transformer<Root> {
  const wikiLinks: WikiLinkContext = {
    resolver: options.resolver ?? mapResolver({}),
    slugger: options.slugger ?? githubSlugger,
    slugify: options.slugify ?? slugify,
    urlPrefix: options.urlPrefix ?? "",
    unresolvedStrategy: options.unresolvedStrategy ?? "link",
  };

  const context = configureEmbeds(this, { ...options, wikiLinks });

  return (tree) => {
    transformEmbeds(tree, context);
  };
}

function add(data: Record<string, unknown>, field: string, value: unknown) {
  if (!data[field]) data[field] = [];
  (data[field] as unknown[]).push(value);
}
