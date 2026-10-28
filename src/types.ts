import type { Literal, Parent, PhrasingContent } from "mdast";

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
};

/** A Resolver backed by a Vault scan: it knows the Note paths it found. */
export type FilesystemResolver = Resolver & {
  /** The Note paths the scan found, e.g. `/folder/Note.md`. */
  paths: readonly string[];
};

export type UnresolvedStrategy = "link" | "plain";

/**
 * Maps a Note path to the slug it is published under. Lets a consumer give
 * Notes that slugify alike (e.g. `Sebá.md` and `Sebã.md`) distinct URLs.
 */
export type SlugifyPath = (path: string) => string;

export type WikiLinksOptions = {
  slugger?: ((text: string) => string) | undefined;
  unresolvedStrategy?: UnresolvedStrategy | undefined;
};

/** How a Note path becomes the URL it is published under. */
export type UrlOptions = {
  slugify?: ((text: string) => string) | undefined;
  slugifyPath?: SlugifyPath | undefined;
  urlPrefix?: string | undefined;
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

export type RemarkObsidianMdOptions = UrlOptions & {
  resolver?: Resolver | undefined;
  wikiLinks?: WikiLinksOptions | undefined;
  blockIds?: BlockIdsOptions | undefined;
  embeds?: EmbedsOptions | undefined;
  callouts?: CalloutsPluginOptions | undefined;
};

export type WikiLinksPluginOptions = UrlOptions & {
  resolver?: Resolver | undefined;
  slugger?: ((text: string) => string) | undefined;
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
 * Intermediate node for `^[text]`. It never reaches the output: a Footnote
 * whose content holds elements becomes a parent carrying the parsed content,
 * and a Footnote whose content is plain text becomes a text node carrying
 * `hName: "sup"`. `value` holds the raw content; `children` holds the parsed
 * content once the content holds elements.
 */
export interface ObsidianFootnoteNode extends Literal {
  type: "obsidianFootnote";
  children?: PhrasingContent[];
}

/**
 * Intermediate node for `==…==`. It never reaches the output: a Highlight
 * whose content holds elements becomes a parent carrying the parsed content,
 * and a Highlight whose content is plain text becomes a text node carrying
 * `hName: "mark"`. `value` holds the raw source; `children` holds the parsed
 * content once the content holds elements.
 */
export interface ObsidianHighlightNode extends Literal {
  type: "obsidianHighlight";
  children?: PhrasingContent[];
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
    obsidianFootnote: ObsidianFootnoteNode;
    obsidianHighlight: ObsidianHighlightNode;
  }

  interface RootContentMap {
    wikiLink: WikiLinkNode;
    embed: EmbedNode;
    obsidianFootnote: ObsidianFootnoteNode;
    obsidianHighlight: ObsidianHighlightNode;
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
