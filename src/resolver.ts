import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

import { load } from "js-yaml";

import type { NoteMetadata, ResolvedTarget, Resolver } from "./types.js";
import { isPlainObject } from "./utils.js";

/**
 * How to pick a winner when several files share a basename or Alias.
 * `"root"` prefers the shallowest path (Obsidian's behaviour), `"first"` and
 * `"last"` follow scan order.
 */
export type DuplicatePolicy = "root" | "first" | "last";

export type FilesystemResolverOptions = {
  duplicatePolicy?: DuplicatePolicy | undefined;
};

type ScanEntry = {
  depth: number;
  target: ResolvedTarget;
  names: string[];
};

/**
 * Builds a Resolver by scanning a Vault directory once, lazily, and caching
 * the resulting index for the Resolver's lifetime.
 *
 * Notes are matched by path, basename and Alias; Assets by path and filename.
 * Matching is case-insensitive and the `.md` extension is optional.
 */
export function filesystemResolver(
  vault: string,
  options: FilesystemResolverOptions = {},
): Resolver {
  const policy = options.duplicatePolicy ?? "root";
  let index: Map<string, ResolvedTarget> | undefined;

  return {
    resolve(target): ResolvedTarget {
      index ??= buildIndex(vault, policy);
      return (
        index.get(normalizeTarget(target)) ?? { kind: "note", exists: false }
      );
    },
  };
}

function buildIndex(
  vault: string,
  policy: DuplicatePolicy,
): Map<string, ResolvedTarget> {
  const winners = new Map<string, ScanEntry>();

  for (const entry of walk(vault, vault)) {
    for (const name of entry.names) {
      const key = normalizeTarget(name);
      if (!key) continue;
      const current = winners.get(key);
      if (!current || beats(entry, current, policy)) winners.set(key, entry);
    }
  }

  return new Map([...winners].map(([key, entry]) => [key, entry.target]));
}

function* walk(dir: string, root: string): Generator<ScanEntry> {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const dirent of entries) {
    if (dirent.name.startsWith(".")) continue;

    const full = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      yield* walk(full, root);
      continue;
    }
    if (!dirent.isFile()) continue;

    const segments = relative(root, full).split(sep);
    const path = `/${segments.join("/")}`;
    const depth = segments.length;

    if (/\.md$/i.test(dirent.name)) {
      const note = readNote(full, dirent.name);
      yield {
        depth,
        target: { kind: "note", exists: true, path, note },
        names: [path, ...note.aliases, note.title],
      };
    } else {
      yield {
        depth,
        target: {
          kind: "asset",
          exists: true,
          path,
          ext: extname(dirent.name).toLowerCase(),
        },
        names: [path, dirent.name],
      };
    }
  }
}

function beats(
  candidate: ScanEntry,
  current: ScanEntry,
  policy: DuplicatePolicy,
): boolean {
  if (policy === "last") return true;
  if (policy === "first") return false;
  return candidate.depth < current.depth;
}

function readNote(file: string, filename: string): NoteMetadata {
  const frontmatter = readFrontmatter(file);

  return {
    title: filename.replace(/\.md$/i, ""),
    aliases: toStringArray(frontmatter.aliases),
    cssclasses: toStringArray(frontmatter.cssclasses),
  };
}

function readFrontmatter(file: string): Record<string, unknown> {
  const source = readFileSync(file, "utf8");
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(
    source,
  );
  if (!match?.[1]) return {};

  try {
    const data: unknown = load(match[1]);
    return isPlainObject(data) ? data : {};
  } catch {
    return {};
  }
}

function toStringArray(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/** A Note supplied to {@link mapResolver}. */
export type MapResolverEntry = {
  path: string;
  title?: string;
  aliases?: string[];
  cssclasses?: string[];
};

/**
 * Builds a Resolver from a caller-supplied map instead of a filesystem scan.
 *
 * Entries are matched case-insensitively, with or without the `.md`
 * extension, by their key, full path, basename or Alias.
 */
export function mapResolver(map: Record<string, MapResolverEntry>): Resolver {
  const index = new Map<string, MapResolverEntry>();
  const depths = new Map<string, number>();

  for (const [key, entry] of Object.entries(map)) {
    const basename = entry.path.split("/").pop() ?? entry.path;
    const depth = entry.path.split("/").filter(Boolean).length;

    for (const name of [key, entry.path, basename, ...(entry.aliases ?? [])]) {
      const id = normalizeTarget(name);
      if (!id) continue;
      // Root-wins on duplicate basenames: the shallowest path takes the name.
      const known = depths.get(id);
      if (known === undefined || depth < known) {
        index.set(id, entry);
        depths.set(id, depth);
      }
    }
  }

  return {
    resolve(target): ResolvedTarget {
      const entry = index.get(normalizeTarget(target));
      if (!entry) return { kind: "note", exists: false };

      const note: NoteMetadata = {
        title: entry.title ?? titleOf(entry.path),
        aliases: entry.aliases ?? [],
        cssclasses: entry.cssclasses ?? [],
      };

      return { kind: "note", exists: true, path: entry.path, note };
    },
  };
}

function normalizeTarget(target: string): string {
  return target
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.mdx?$/i, "")
    .toLowerCase();
}

function titleOf(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.mdx?$/i, "");
}
