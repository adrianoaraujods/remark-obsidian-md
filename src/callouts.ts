import type { Blockquote, PhrasingContent, Root, RootContent } from "mdast";
import type { Processor, Transformer } from "unified";

import type {
  CalloutNode,
  CalloutPartNode,
  CalloutsPluginOptions,
  CalloutTypeDefinition,
} from "./types.js";

/**
 * The 13 canonical Callout types and the icon each one exposes to the theme.
 * Glyphs are CSS's job: only the Lucide icon name is emitted, as `data-icon`.
 */
const CANONICAL_TYPES: Record<string, CalloutTypeDefinition> = {
  note: { icon: "pencil" },
  abstract: { icon: "clipboard-list" },
  info: { icon: "info" },
  todo: { icon: "check-circle-2" },
  tip: { icon: "flame" },
  success: { icon: "check" },
  question: { icon: "help-circle" },
  warning: { icon: "alert-triangle" },
  failure: { icon: "x" },
  danger: { icon: "zap" },
  bug: { icon: "bug" },
  example: { icon: "list" },
  quote: { icon: "quote" },
};

const ALIASES: Record<string, string> = {
  summary: "abstract",
  tldr: "abstract",
  hint: "tip",
  important: "tip",
  check: "success",
  done: "success",
  help: "question",
  faq: "question",
  caution: "warning",
  attention: "warning",
  fail: "failure",
  missing: "failure",
  error: "danger",
  cite: "quote",
};

const FALLBACK_TYPE = "note";

type ParsedCallout = {
  type: string;
  definition: CalloutTypeDefinition;
  defaultTitle: string;
  title: PhrasingContent[];
  fold: "+" | "-" | undefined;
  body: RootContent[];
};

/**
 * Matches the Obsidian callout marker at the start of the first line:
 * `[!type]`, an optional fold marker (`+`/`-`) and one optional space.
 */
const MARKER_REGEX = /^\[!([^\]\n]+)\]([+-]?)\s?/;

export function transformCallouts(
  tree: Root,
  options: CalloutsPluginOptions = {},
): void {
  transformChildren(tree, options);
}

function transformChildren(
  parent: Root | Blockquote | RootContent,
  options: CalloutsPluginOptions,
) {
  if (!("children" in parent)) return;

  // Deepest first, so a nested Callout is already rendered when its parent
  // moves the (transformed) children into the content wrapper.
  for (const child of parent.children) {
    transformChildren(child, options);
  }

  const children = parent.children as RootContent[];
  for (let index = 0; index < children.length; index++) {
    const child = children[index];
    if (child?.type !== "blockquote") continue;

    const callout = toCallout(child, options);
    if (callout) children[index] = callout;
  }
}

function toCallout(
  node: Blockquote,
  options: CalloutsPluginOptions,
): CalloutNode | undefined {
  const parsed = parseCallout(node, options);
  if (!parsed) return undefined;

  const { type, definition, defaultTitle, title, fold, body } = parsed;
  const foldable = fold !== undefined;

  const icon: PhrasingContent = {
    type: "text",
    value: "",
    data: {
      hName: "span",
      hProperties: {
        className: ["callout-title-icon"],
        "data-icon": definition.icon ?? CANONICAL_TYPES[type]?.icon ?? "pencil",
      },
    },
  };

  const titleInner: CalloutPartNode = {
    type: "calloutPart",
    data: {
      hName: "div",
      hProperties: { className: ["callout-title-inner"] },
    },
    children:
      title.length > 0 ? title : [{ type: "text", value: defaultTitle }],
  };

  const titleWrapper: CalloutPartNode = {
    type: "calloutPart",
    data: {
      // `<summary>` is what makes a foldable Callout toggle without JS.
      hName: foldable ? "summary" : "div",
      hProperties: { className: ["callout-title"] },
    },
    children: [icon, titleInner],
  };

  const content: CalloutPartNode = {
    type: "calloutPart",
    data: {
      hName: "div",
      hProperties: { className: ["callout-content"] },
    },
    children: body,
  };

  return {
    type: "callout",
    data: {
      hName: foldable ? "details" : "div",
      hProperties: {
        className: foldable ? ["callout", "is-collapsible"] : ["callout"],
        "data-callout": type,
        ...(fold === "+" ? { open: true } : {}),
        ...(definition.color
          ? { style: `--callout-color: ${definition.color}` }
          : {}),
      },
    },
    children: [titleWrapper, content],
  };
}

function parseCallout(
  node: Blockquote,
  options: CalloutsPluginOptions,
): ParsedCallout | undefined {
  const first = node.children[0];
  if (first?.type !== "paragraph") return undefined;

  const lead = first.children[0];
  if (lead?.type !== "text") return undefined;

  const match = MARKER_REGEX.exec(lead.value);
  if (!match) return undefined;

  const rawType = match[1] ?? "";
  const { type, definition, defaultTitle } = resolveType(
    rawType,
    options.types,
  );
  const fold = (match[2] || undefined) as "+" | "-" | undefined;

  const line = splitFirstLine(first.children);
  const leading = line[0][0];
  if (leading?.type === "text") {
    leading.value = leading.value.slice(match[0].length).trimStart();
    if (leading.value === "") line[0].shift();
  }

  const title = line[0];
  const rest = line[1];
  const body: RootContent[] = [];

  if (rest.length > 0) body.push({ type: "paragraph", children: rest });
  body.push(...node.children.slice(1));

  return { type, definition, defaultTitle, title, fold, body };
}

/** Splits phrasing children at the first soft or hard line break. */
function splitFirstLine(
  children: PhrasingContent[],
): [PhrasingContent[], PhrasingContent[]] {
  for (let index = 0; index < children.length; index++) {
    const child = children[index];
    if (!child) continue;

    if (child.type === "break") {
      return [children.slice(0, index), children.slice(index + 1)];
    }

    if (child.type === "text") {
      const newline = child.value.indexOf("\n");
      if (newline === -1) continue;

      const head = children.slice(0, index);
      if (newline > 0)
        head.push({ ...child, value: child.value.slice(0, newline) });

      const tail = children.slice(index + 1);
      const remainder = child.value.slice(newline + 1);
      if (remainder !== "") tail.unshift({ ...child, value: remainder });

      return [head, tail];
    }
  }

  return [children, []];
}

function resolveType(
  raw: string,
  custom: CalloutsPluginOptions["types"] = {},
): { type: string; definition: CalloutTypeDefinition; defaultTitle: string } {
  const trimmed = raw.trim();
  const id = trimmed.toLowerCase();

  const resolve = (type: string, definition: CalloutTypeDefinition) => ({
    type,
    definition,
    // Obsidian titles the Callout with what the author typed, aliases included.
    defaultTitle: definition.title ?? capitalize(trimmed),
  });

  if (custom[id]) return resolve(id, custom[id]);
  if (CANONICAL_TYPES[id]) return resolve(id, CANONICAL_TYPES[id]);

  const alias = ALIASES[id];
  if (alias) {
    return resolve(alias, custom[alias] ?? CANONICAL_TYPES[alias] ?? {});
  }

  // Unknown types render as `note`; the author's label survives as the title.
  return resolve(
    FALLBACK_TYPE,
    custom[FALLBACK_TYPE] ?? CANONICAL_TYPES[FALLBACK_TYPE] ?? {},
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function remarkObsidianCallouts(
  _this: Processor,
  options: CalloutsPluginOptions = {},
): Transformer<Root> {
  return (tree) => {
    transformCallouts(tree, options);
  };
}
