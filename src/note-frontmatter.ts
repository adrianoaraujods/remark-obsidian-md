import { load } from "js-yaml";

import { isPlainObject } from "./utils.js";

/** A Note source split into its Frontmatter and its body. */
export type FrontmatterSplit = {
  frontmatter: Record<string, unknown>;
  /**
   * The YAML source between the fences, as written but with line endings
   * normalized to LF; empty when there is none.
   */
  yamlSource: string;
  body: string;
};

/**
 * Splits a Note source into its Frontmatter and body.
 *
 * The Frontmatter is the block fenced by `---` lines at the very top of the
 * Note (a leading byte-order mark is tolerated) whose content parses, through
 * js-yaml, into a plain object. Anything else — no closing fence, invalid
 * YAML, YAML that is not a mapping, an empty block — is not Frontmatter, and
 * the source is left untouched.
 */
export function splitFrontmatter(source: string): FrontmatterSplit {
  const text = source.startsWith("\uFEFF") ? source.slice(1) : source;
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);

  if (!match) return { frontmatter: {}, yamlSource: "", body: source };

  let data: unknown;
  try {
    data = load(match[1] ?? "");
  } catch {
    return { frontmatter: {}, yamlSource: "", body: source };
  }

  if (!isPlainObject(data)) {
    return { frontmatter: {}, yamlSource: "", body: source };
  }

  return {
    frontmatter: data,
    yamlSource: (match[1] ?? "").replace(/\r\n/g, "\n"),
    body: text.slice(match[0].length),
  };
}
