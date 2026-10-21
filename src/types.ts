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
  unresolvedStrategy?: UnresolvedStrategy | undefined;
};

export type RemarkObsidianMdOptions = {
  resolver?: Resolver | undefined;
  slugify?: ((text: string) => string) | undefined;
  urlPrefix?: string | undefined;
  wikiLinks?: WikiLinksOptions | undefined;
  callouts?: CalloutsPluginOptions | undefined;
};

export type WikiLinksPluginOptions = {
  resolver?: Resolver | undefined;
  slugify?: ((text: string) => string) | undefined;
  urlPrefix?: string | undefined;
  unresolvedStrategy?: UnresolvedStrategy | undefined;
};

export type WikiLinkContext = {
  resolver: Resolver;
  slugify: (text: string) => string;
  urlPrefix: string;
  unresolvedStrategy: UnresolvedStrategy;
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
  }

  interface RootContentMap {
    wikiLink: WikiLinkNode;
    callout: CalloutNode;
    calloutPart: CalloutPartNode;
  }
}

declare module "micromark-util-types" {
  interface TokenTypeMap {
    wikiLink: "wikiLink";
  }
}
