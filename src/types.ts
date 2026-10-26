import type { Literal, Parent } from "mdast";

export type NoteMetadata = {
  title: string;
  aliases: string[];
  cssclasses: string[];
};

export type ResolvedTarget =
  | { kind: "note"; exists: true; path: string; note: NoteMetadata }
  | { kind: "asset"; exists: true; path: string; ext: string }
  | { kind: "note" | "asset"; exists: false };

export type Resolver = {
  resolve(target: string): ResolvedTarget;
  /** The Note paths a resolver knows about, when it scanned a Vault. */
  paths?: readonly string[] | undefined;
};

export type UnresolvedStrategy = "link" | "plain";

/**
 * Maps a Note path to the URL path it is published under. Lets a consumer
 * give Notes that slugify alike (e.g. `Sebá.md` and `Sebã.md`) distinct URLs.
 */
export type SlugifyPath = (path: string) => string;

export type WikiLinksOptions = {
  slugger?: ((text: string) => string) | undefined;
  unresolvedStrategy?: UnresolvedStrategy | undefined;
};

export type BlockIdsOptions = {
  /** Reads a Note's markdown by its resolved path, for cross-Note Block References. */
  readNote?: ((path: string) => string | undefined) | undefined;
};

export type EmbedsOptions = {
  /** Reads a Note's markdown by its resolved path. */
  readNote?: ((path: string) => string | undefined) | undefined;
  /** Maximum nesting depth; defaults to 4. */
  maxDepth?: number | undefined;
};

export type RemarkObsidianMdOptions = {
  resolver?: Resolver | undefined;
  slugify?: ((text: string) => string) | undefined;
  slugifyPath?: SlugifyPath | undefined;
  urlPrefix?: string | undefined;
  wikiLinks?: WikiLinksOptions | undefined;
  blockIds?: BlockIdsOptions | undefined;
  embeds?: EmbedsOptions | undefined;
  callouts?: CalloutsPluginOptions | undefined;
};

export type WikiLinksPluginOptions = {
  resolver?: Resolver | undefined;
  slugger?: ((text: string) => string) | undefined;
  slugify?: ((text: string) => string) | undefined;
  slugifyPath?: SlugifyPath | undefined;
  urlPrefix?: string | undefined;
  unresolvedStrategy?: UnresolvedStrategy | undefined;
};

export type EmbedsPluginOptions = WikiLinksPluginOptions & EmbedsOptions;

export type WikiLinkContext = {
  resolver: Resolver;
  slugger: (text: string) => string;
  slugify: (text: string) => string;
  slugifyPath?: SlugifyPath | undefined;
  urlPrefix: string;
  unresolvedStrategy: UnresolvedStrategy;
  /** Current Note's Block IDs plus a reader for cross-Note lookups. */
  blockIds?:
    | {
        current: ReadonlyMap<string, unknown>;
        readNote?: ((path: string) => string | undefined) | undefined;
      }
    | undefined;
};

export type CalloutTypeDefinition = {
  icon?: string;
  color?: string;
  title?: string;
};

export type CalloutsPluginOptions = {
  types?: Record<string, CalloutTypeDefinition>;
};

/** Intermediate node produced by the Wiki Link tokenizer. */
export interface WikiLinkNode extends Literal {
  type: "wikiLink";
}

/**
 * Embedded content. `value` holds the raw `![[…]]` inner text only until
 * the Embed transform turns it into a container with parsed children.
 */
export interface EmbedNode extends Parent {
  type: "embed";
  value?: string;
}

/**
 * A Callout. Unlike `embed`, its wrapper structure has no native MDAST
 * equivalent, so title/content wrappers use the internal `calloutPart` node.
 */
export interface CalloutNode extends Parent {
  type: "callout";
  children: CalloutPartNode[];
}

/** One rendered wrapper inside a Callout (`callout-title`, `callout-content`…). */
export interface CalloutPartNode extends Parent {
  type: "calloutPart";
}

declare module "mdast" {
  interface PhrasingContentMap {
    wikiLink: WikiLinkNode;
    embed: EmbedNode;
  }

  interface RootContentMap {
    wikiLink: WikiLinkNode;
    embed: EmbedNode;
    callout: CalloutNode;
    calloutPart: CalloutPartNode;
  }
}

declare module "micromark-util-types" {
  interface TokenTypeMap {
    wikiLink: "wikiLink";
    embed: "embed";
  }
}
