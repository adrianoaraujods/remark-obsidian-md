import GithubSlugger from "github-slugger";
import { codes } from "micromark-util-symbol";
import type { Code } from "micromark-util-types";

import type { SlugifyPath } from "./types.js";

export const WIKI_LINK_REGEX = /(!)?\[\[(.*?)\]\]/;

/** A Subpath, structured: either a Heading name or a Block ID (without the `^`). */
export type ParsedSubpath = {
  kind: "heading" | "blockId";
  value: string;
};

export type ParsedWikiLink = {
  target: string;
  alias: string | undefined;
  subpaths: string[];
  /** The innermost Subpath: the part the anchor points at. */
  subpath: ParsedSubpath | undefined;
  rawTarget: string;
};

/**
 * Splits the inner text of a Wiki Link into its Link Target, Alias and
 * Subpaths. A `\|` is accepted as the alias separator (tables escape pipes).
 */
export function parseWikiLink(content: string): ParsedWikiLink | null {
  const pipeIndex = content.indexOf("|");

  let rawTarget: string;
  let alias: string | undefined;

  if (pipeIndex === -1) {
    rawTarget = content;
  } else {
    rawTarget = content.slice(0, pipeIndex).replace(/\\$/, "");
    alias = content
      .slice(pipeIndex + 1)
      .replace(/\\\|/g, "|")
      .trim();
  }

  // Clean up whitespace and normalize slashes
  rawTarget = rawTarget.replace(/\\/g, "/").trim();

  const [target = "", ...subpaths] = rawTarget.split("#");
  const cleanTarget = target.trim();
  const cleanSubpaths = subpaths.map((part) => part.trim()).filter(Boolean);
  if (!cleanTarget && cleanSubpaths.length === 0) return null;

  const last = cleanSubpaths.at(-1);

  return {
    target: cleanTarget,
    alias,
    subpaths: cleanSubpaths,
    subpath: last
      ? {
          kind: last.startsWith("^") ? "blockId" : "heading",
          value: last.startsWith("^") ? last.slice(1) : last,
        }
      : undefined,
    rawTarget,
  };
}

/** GitHub-style heading slug, the default anchor slugger. */
export function githubSlugger(text: string): string {
  return new GithubSlugger().slug(text);
}

/**
 * Turns a Subpath into a URL fragment. A nested chain links to its innermost
 * heading, which is the heading that actually carries the anchor. Block
 * References (`#^id`) keep their marker verbatim.
 */
export function anchorFor(
  subpath: ParsedSubpath | undefined,
  slugger: (text: string) => string,
): string | undefined {
  if (!subpath) return undefined;
  return subpath.kind === "blockId"
    ? `^${subpath.value}`
    : slugger(subpath.value);
}

/**
 * Spells a run of `+`/`#` so that symbol-bearing names stay distinct: without
 * this, `C++`, `C#` and `C` all slugify to `c`.
 */
function spellSymbols(symbols: string): string[] {
  return [...symbols].map((symbol) => (symbol === "+" ? " plus" : " sharp"));
}

/**
 * Converts a string into a URL-friendly slug.
 *
 * Symbols that follow a word are spelled out (`C++` → `c-plus-plus`,
 * `C#` → `c-sharp`); any other punctuation is dropped.
 *
 * @param {string} text - The string to be slugified.
 * @returns {string} A lowercase, hyphenated, URL-safe string.
 * @example
 * slugify("Hello World!");        // "hello-world"
 * slugify("crème brûlée");       // "creme-brulee"
 * slugify("myCamelCaseString");  // "my-camel-case-string"
 * slugify("C++");                // "c-plus-plus"
 */
export function slugify(text: string): string {
  if (!text) return "";

  return (
    text
      .toString()
      .trim()
      // 1. Handle camelCase (e.g., "myPostTitle" -> "my Post Title")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      // 2. Normalize accents (e.g., "é" -> "e")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      // 3. Spell symbols that follow a word, so "C++"/"C#" stay distinct from "C"
      .replace(/([a-z0-9])([+#]+)/gi, (_, word: string, symbols: string) =>
        [word, ...spellSymbols(symbols)].join(""),
      )
      // 4. Lowercase everything
      .toLowerCase()
      // 5. Replace all non-alphanumeric chars with a hyphen
      .replace(/[^a-z0-9]+/g, "-")
      // 6. Remove leading/trailing hyphens and prevent double hyphens
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-")
  );
}

/** Whether a micromark code is a line ending (LF, CR or CRLF). */
export function isLineEnding(code: Code): boolean {
  return (
    code === codes.carriageReturn ||
    code === codes.carriageReturnLineFeed ||
    code === codes.lineFeed
  );
}

/** A plain object: not null, not an array, no class prototype. */
export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Concatenates a node's text content: its own value, or its children's. */
export function textOf(node: unknown): string {
  if (!node || typeof node !== "object") return "";

  const { value, children } = node as {
    value?: unknown;
    children?: unknown[];
  };

  if (typeof value === "string") return value;
  if (Array.isArray(children)) return children.map(textOf).join("");
  return "";
}

/**
 * Normalizes a Vault path: backslashes become slashes, surrounding space,
 * a leading slash and the markdown extension are dropped.
 */
export function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.mdx?$/i, "");
}

/**
 * Slugifies each path segment and joins them into a slug.
 */
export function slugifySegments(
  segments: readonly string[],
  slugifySegment: (text: string) => string,
): string {
  return segments.map(slugifySegment).join("/");
}

/**
 * Builds a root-relative, slugified URL from a vault-relative file path.
 *
 * @param path - The file path as stored in the content map (with or without a
 *   leading slash).
 * @param options.slugify - Slugify function used per path segment.
 * @param options.slugifyPath - Optional map from a Note path to the slug it
 *   is published under; takes precedence over `slugify` when given.
 * @param options.urlPrefix - Optional prefix prepended to the URL (e.g. "/docs").
 * @param options.anchor - Optional, already slugged heading anchor.
 * @returns A URL starting with `/`, e.g. `/docs/folder/note#some-heading`.
 */
export function slugifyUrl(
  path: string,
  options: {
    slugify: (text: string) => string;
    slugifyPath?: SlugifyPath | undefined;
    urlPrefix?: string;
    anchor?: string;
  },
): string {
  const slug = options.slugifyPath
    ? options.slugifyPath(path)
    : slugifySegments(
        path
          .replace(/\.mdx?$/, "")
          .split("/")
          .filter(Boolean),
        options.slugify,
      );

  const trimmedPrefix = options.urlPrefix?.replace(/^\/+|\/+$/g, "");
  const prefixPart = trimmedPrefix ? `${trimmedPrefix}/` : "";

  const anchorPart = options.anchor ? `#${options.anchor}` : "";

  return `/${prefixPart}${slug}${anchorPart}`;
}
