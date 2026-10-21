import GithubSlugger from "github-slugger";

export const WIKI_LINK_REGEX = /(!)?\[\[(.*?)\]\]/;
export const HIGHLIGHT_REGEX = /==(.*?)==/;

export type ParsedWikiLink = {
  target: string;
  alias: string | undefined;
  subpaths: string[];
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

  return {
    target: cleanTarget,
    alias,
    subpaths: cleanSubpaths,
    rawTarget,
  };
}

/** GitHub-style heading slug, the default anchor slugger. */
export function githubSlugger(text: string): string {
  return new GithubSlugger().slug(text);
}

/**
 * Turns Subpaths into a URL fragment. A nested chain links to its innermost
 * heading, which is the heading that actually carries the anchor. Block
 * References (`#^id`) keep their marker verbatim.
 */
export function anchorFor(
  subpaths: string[],
  slugger: (text: string) => string,
): string | undefined {
  const last = subpaths.at(-1);
  if (!last) return undefined;
  return last.startsWith("^") ? last : slugger(last);
}

/**
 * Converts a string into a URL-friendly slug.
 *
 * @param {string} text - The string to be slugified.
 * @returns {string} A lowercase, hyphenated, URL-safe string.
 * @example
 * slugify("Hello World!");        // "hello-world"
 * slugify("crème brûlée");       // "creme-brulee"
 * slugify("myCamelCaseString");  // "my-camel-case-string"
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
      // 3. Lowercase everything
      .toLowerCase()
      // 4. Replace all non-alphanumeric chars with a hyphen
      .replace(/[^a-z0-9]+/g, "-")
      // 5. Remove leading/trailing hyphens and prevent double hyphens
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-")
  );
}

/**
 * Builds a root-relative, slugified URL from a vault-relative file path.
 *
 * @param path - The file path as stored in the content map (with or without a
 *   leading slash).
 * @param options.slugify - Slugify function used per path segment.
 * @param options.urlPrefix - Optional prefix prepended to the URL (e.g. "/docs").
 * @param options.anchor - Optional, already slugged heading anchor.
 * @returns A URL starting with `/`, e.g. `/docs/folder/note#some-heading`.
 */
export function slugifyUrl(
  path: string,
  options: {
    slugify: (text: string) => string;
    urlPrefix?: string;
    anchor?: string;
  },
): string {
  const base = path.replace(/\.mdx?$/, "");
  const slug = base
    .split("/")
    .filter(Boolean)
    .map((part) => options.slugify(part))
    .join("/");

  const trimmedPrefix = options.urlPrefix?.replace(/^\/+|\/+$/g, "");
  const prefixPart = trimmedPrefix ? `${trimmedPrefix}/` : "";

  const anchorPart = options.anchor ? `#${options.anchor}` : "";

  return `/${prefixPart}${slug}${anchorPart}`;
}
