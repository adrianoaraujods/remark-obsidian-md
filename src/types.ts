import type { Literal } from "mdast";

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

export type RemarkObsidianMdOptions = {
  resolver?: Resolver | undefined;
  slugger?: ((text: string) => string) | undefined;
  slugify?: ((text: string) => string) | undefined;
  urlPrefix?: string | undefined;
  wikiLinks?: WikiLinksOptions | undefined;
};

export type WikiLinksPluginOptions = {
  resolver?: Resolver | undefined;
  slugger?: ((text: string) => string) | undefined;
  slugify?: ((text: string) => string) | undefined;
  urlPrefix?: string | undefined;
  unresolvedStrategy?: UnresolvedStrategy | undefined;
};

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

declare module "mdast" {
  interface PhrasingContentMap {
    wikiLink: WikiLinkNode;
  }

  interface RootContentMap {
    wikiLink: WikiLinkNode;
  }
}

declare module "micromark-util-types" {
  interface TokenTypeMap {
    wikiLink: "wikiLink";
  }
}
