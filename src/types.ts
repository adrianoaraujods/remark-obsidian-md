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
};

export type UnresolvedStrategy = "link" | "plain";

export type WikiLinksOptions = {
  slugger?: ((text: string) => string) | undefined;
  unresolvedStrategy?: UnresolvedStrategy | undefined;
};

export type EmbedsOptions = {
  /** Reads a Note's markdown by its resolved path. */
  readNote?: ((path: string) => string | undefined) | undefined;
  /** Maximum nesting depth; defaults to 4. */
  maxDepth?: number | undefined;
};

export type RemarkObsidianMdOptions = {
  resolver?: Resolver | undefined;
  slugger?: ((text: string) => string) | undefined;
  slugify?: ((text: string) => string) | undefined;
  urlPrefix?: string | undefined;
  wikiLinks?: WikiLinksOptions | undefined;
  embeds?: EmbedsOptions | undefined;
};

export type WikiLinksPluginOptions = {
  resolver?: Resolver | undefined;
  slugger?: ((text: string) => string) | undefined;
  slugify?: ((text: string) => string) | undefined;
  urlPrefix?: string | undefined;
  unresolvedStrategy?: UnresolvedStrategy | undefined;
};

export type EmbedsPluginOptions = WikiLinksPluginOptions & EmbedsOptions;

export type WikiLinkContext = {
  resolver: Resolver;
  slugger: (text: string) => string;
  slugify: (text: string) => string;
  urlPrefix: string;
  unresolvedStrategy: UnresolvedStrategy;
};

/** Intermediate node produced by the Wiki Link tokenizer. */
export interface WikiLinkNode extends Literal {
  type: "wikiLink";
}

/**
 * Transcluded content. `value` holds the raw `![[…]]` inner text only until
 * the Embed transform turns it into a container with parsed children.
 */
export interface EmbedNode extends Parent {
  type: "embed";
  value?: string;
}

declare module "mdast" {
  interface PhrasingContentMap {
    wikiLink: WikiLinkNode;
    embed: EmbedNode;
  }

  interface RootContentMap {
    wikiLink: WikiLinkNode;
    embed: EmbedNode;
  }
}

declare module "micromark-util-types" {
  interface TokenTypeMap {
    wikiLink: "wikiLink";
    embed: "embed";
  }
}
