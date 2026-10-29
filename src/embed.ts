import type {
  Heading,
  ListItem,
  PhrasingContent,
  Root,
  RootContent,
} from "mdast";
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

import { type BlockIndex, processBlockIds } from "./block-id.js";
import { addExtension } from "./extensions.js";
import { transformHighlights } from "./highlights.js";
import type {
  EmbedNode,
  EmbedsOptions,
  EmbedsPluginOptions,
  ResolvedTarget,
  WikiLinkContext,
} from "./types.js";
import {
  type ParsedWikiLink,
  parseWikiLink,
  splitFrontmatter,
  textOf,
} from "./utils.js";
import {
  defaultWikiLinkContext,
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
  "obsidianFootnote",
]);

/**
 * Expands every Embed into its target's parsed content. Whole-Note, partial
 * (heading/block) and Asset targets are all dispatched through
 * `resolveEmbed`.
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
}

/**
 * Assigns the container element for every Embed and hoists block-content
 * Embeds out of paragraphs. Runs after `transformEmbeds` and after any
 * transform that creates new paragraphs (e.g. Callouts), so those are
 * covered too.
 */
export function finalizeEmbeds(tree: Root): void {
  splitBlockEmbeds(tree);
  annotateContainers(tree);
}

function resolveEmbed(
  node: EmbedNode,
  context: EmbedContext,
  state: EmbedState,
): RootContent {
  const parsed = parseWikiLink(node.value ?? "");

  if (!parsed) return literalEmbed(node);

  const resolved = context.wikiLinks.resolver.resolve(parsed.target);

  if (!resolved.exists) return placeholder(parsed.target);

  if (resolved.kind === "asset") {
    return assetEmbed(parsed, resolved);
  }

  // The target resolved, but the cycle/depth guard stops here: mark the
  // placeholder neutrally so it is not mistaken for an unresolved target.
  if (state.depth >= context.maxDepth || state.visited.has(resolved.path)) {
    return placeholder(parsed.target, "is-embed-limit");
  }

  const content = context.readNote(resolved.path);

  if (content === undefined) {
    return placeholder(parsed.target);
  }

  const children = parseEmbedded(
    content,
    context,
    {
      depth: state.depth + 1,
      visited: new Set([...state.visited, resolved.path]),
    },
    parsed,
  );

  if (!children) return placeholder(parsed.target);

  return {
    type: "embed",
    data: {
      hProperties: {
        className: ["internal-embed", ...resolved.note.cssclasses],
      },
    },
    children,
  };
}

function placeholder(target: string, marker = "is-unresolved"): EmbedNode {
  return {
    type: "embed",
    data: {
      hProperties: { className: ["internal-embed", marker] },
    },
    children: [{ type: "text", value: target }],
  };
}

function literalEmbed(node: EmbedNode): RootContent {
  return { type: "text", value: `![[${node.value ?? ""}]]` };
}

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
  ".bmp",
  ".ico",
]);
const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".ogg",
  ".oga",
  ".m4a",
  ".flac",
  ".aac",
  ".opus",
]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".ogv", ".mov", ".m4v"]);

/** Obsidian reads a numeric Asset Alias as a size: `|300` or `|300x200`. */
function parseSize(alias: string | undefined) {
  const match = alias?.match(/^(\d+)(?:x(\d+))?$/i);
  if (!match?.[1]) return null;

  return {
    width: Number(match[1]),
    height: match[2] ? Number(match[2]) : undefined,
  };
}

/**
 * Assets are leaves: the target's file is referenced in place rather than
 * parsed. Images map to the native `image` node; audio and video reuse the
 * `embed` node with their media element as `hName`; anything else links.
 */
function assetEmbed(
  parsed: ParsedWikiLink,
  asset: Extract<ResolvedTarget, { kind: "asset"; exists: true }>,
): RootContent {
  const ext = asset.ext.toLowerCase();

  if (IMAGE_EXTENSIONS.has(ext)) {
    const size = parseSize(parsed.alias);
    return {
      type: "image",
      url: asset.path,
      alt: size ? "" : (parsed.alias ?? ""),
      data: {
        hProperties: {
          className: ["internal-embed"],
          ...(size?.width !== undefined ? { width: size.width } : {}),
          ...(size?.height !== undefined ? { height: size.height } : {}),
        },
      },
    };
  }

  const hName = AUDIO_EXTENSIONS.has(ext)
    ? "audio"
    : VIDEO_EXTENSIONS.has(ext)
      ? "video"
      : undefined;

  if (!hName) {
    return {
      type: "link",
      url: asset.path,
      children: [{ type: "text", value: parsed.alias || parsed.target }],
      data: { hProperties: { className: ["internal-embed"] } },
    };
  }

  return {
    type: "embed",
    data: {
      hName,
      hProperties: {
        className: ["internal-embed"],
        src: asset.path,
        controls: true,
      },
    },
    children: [],
  };
}

function parseEmbedded(
  markdown: string,
  context: EmbedContext,
  state: EmbedState,
  parsed: ParsedWikiLink,
): RootContent[] | undefined {
  const processor = unified().use(remarkParse);
  const input = context.processor.data() as Record<string, unknown>;
  const data = processor.data() as Record<string, unknown>;

  // Reuse every inline tokenizer available to the host pipeline (Wiki Link,
  // Embed, Comment, Footnote).
  const micromarkExtensions = [
    ...((input.micromarkExtensions as unknown[] | undefined) ?? []),
  ];
  const fromMarkdownExtensions = [
    ...((input.fromMarkdownExtensions as unknown[] | undefined) ?? []),
  ];

  // Standalone use has no Wiki Link tokenizer on the host pipeline yet, but
  // embedded content must still resolve its Wiki Links.
  if (!micromarkExtensions.includes(wikiLinkSyntax)) {
    micromarkExtensions.push(wikiLinkSyntax);
  }
  if (!fromMarkdownExtensions.includes(wikiLinkFromMarkdown)) {
    fromMarkdownExtensions.push(wikiLinkFromMarkdown);
  }

  data.micromarkExtensions = micromarkExtensions;
  data.fromMarkdownExtensions = fromMarkdownExtensions;

  // The embedded Note's Frontmatter is hidden: it is stripped before the
  // source is parsed, so whole-Note, section, Block ID and nested Embeds are
  // all clean.
  const { body } = splitFrontmatter(markdown);
  const tree = processor.runSync(processor.parse(body)) as Root;

  if (parsed.subpath) {
    const blockIds = processBlockIds(tree);
    const selected =
      parsed.subpath.kind === "blockId"
        ? selectBlock(blockIds, parsed.subpath.value)
        : selectSection(tree.children, parsed.subpaths);

    if (!selected) return undefined;

    tree.children = selected;
  }

  transformWikiLinks(tree, context.wikiLinks);
  transformEmbeds(tree, context, state);
  transformHighlights(tree);

  return tree.children;
}

/** Selects the AST node carrying a Block ID. */
function selectBlock(
  blockIds: BlockIndex,
  id: string,
): RootContent[] | undefined {
  const target = blockIds.get(id);
  if (!target) return undefined;

  // A lone list item is not valid at root; wrap it back in a list.
  if (target.type === "listItem") {
    return [
      {
        type: "list",
        ordered: false,
        spread: false,
        children: [target as unknown as ListItem],
      },
    ];
  }

  return [target as unknown as RootContent];
}

/**
 * Selects the heading's section: the heading itself up to, but excluding, the
 * next heading of the same or higher level. Nested Subpaths walk deeper into
 * the previous Subpath's section.
 */
function selectSection(
  children: RootContent[],
  subpaths: string[],
): RootContent[] | undefined {
  let start = 0;
  let end = children.length;
  let level = 0;
  let found: { index: number; level: number } | undefined;

  for (const subpath of subpaths) {
    found = undefined;

    for (let i = start; i < end; i++) {
      const node = children[i];
      if (node?.type !== "heading") continue;
      if (sameHeading(node, subpath)) {
        found = { index: i, level: node.depth };
        break;
      }
    }

    if (!found) return undefined;

    start = found.index + 1;
    level = found.level;
    end = sectionEnd(children, start, level);
  }

  if (!found) return undefined;

  return children.slice(found.index, end);
}

function sectionEnd(
  children: RootContent[],
  from: number,
  level: number,
): number {
  for (let i = from; i < children.length; i++) {
    const node = children[i];
    if (node?.type === "heading" && node.depth <= level) return i;
  }

  return children.length;
}

function sameHeading(node: Heading, subpath: string): boolean {
  return normalizeHeading(textOf(node)) === normalizeHeading(subpath);
}

function normalizeHeading(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Breaks paragraphs around block-content Embeds so transcluded block Markdown
 * never ends up inside a `<p>`/`<span>` (invalid HTML, hydration errors). A
 * lone Embed is promoted as before; phrasing Embeds (placeholders, media)
 * stay inline. Embeds inside headings or table cells cannot be split and are
 * left inline.
 */
function splitBlockEmbeds(tree: Root): void {
  visit(tree, "paragraph", (node, index, parent) => {
    if (index === undefined || !parent) return;

    const lone = node.children.length === 1;
    const isBlock = (child: RootContent): child is EmbedNode =>
      child.type === "embed" && (lone || hasBlockChildren(child));

    if (!node.children.some(isBlock)) return;

    const segments: RootContent[] = [];
    let phrasing: PhrasingContent[] = [];

    for (const child of node.children) {
      if (isBlock(child)) {
        if (phrasing.length > 0) {
          segments.push({ type: "paragraph", children: phrasing });
          phrasing = [];
        }
        segments.push(child);
      } else {
        phrasing.push(child as PhrasingContent);
      }
    }

    if (phrasing.length > 0) {
      segments.push({ type: "paragraph", children: phrasing });
    }

    parent.children.splice(index, 1, ...segments);
  });
}

/** Phrasing MDAST types; anything else in an Embed's children is block. */
const INLINE_TYPES = new Set([
  "text",
  "emphasis",
  "strong",
  "inlineCode",
  "image",
  "imageReference",
  "link",
  "linkReference",
  "break",
  "html",
  "delete",
  "footnote",
  "footnoteReference",
  "obsidianFootnote",
  "inlineMath",
  "mdxJsxTextElement",
  "mdxTextExpression",
]);

function hasBlockChildren(node: EmbedNode): boolean {
  return node.children.some((child) => !INLINE_TYPES.has(child.type));
}

function annotateContainers(tree: Root): void {
  visit(tree, "embed", (node, _index, parent) => {
    const data = (node.data ?? {}) as {
      hName?: string;
      hProperties?: Record<string, unknown>;
    };

    // Media leaves (and anything else that chose its own element) keep it.
    if (data.hName) return;

    const block = !parent || !PHRASING_PARENTS.has(parent.type);

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
  addExtension(processor, "micromarkExtensions", embedSyntax);
  addExtension(processor, "fromMarkdownExtensions", embedFromMarkdown);

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
  const wikiLinks = defaultWikiLinkContext(options);

  const context = configureEmbeds(this, { ...options, wikiLinks });

  return (tree) => {
    transformEmbeds(tree, context);
    finalizeEmbeds(tree);
  };
}
