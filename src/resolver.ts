import type { NoteMetadata, ResolvedTarget, Resolver } from "./types.js";

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
  // First match wins; root-wins on duplicate basenames is a filesystemResolver
  // concern.
  const index = new Map<string, MapResolverEntry>();

  for (const [key, entry] of Object.entries(map)) {
    const basename = entry.path.split("/").pop() ?? entry.path;
    for (const name of [key, entry.path, basename, ...(entry.aliases ?? [])]) {
      const id = normalizeTarget(name);
      if (!index.has(id)) index.set(id, entry);
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
