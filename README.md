# remark-obsidian-md

[![NPM Version](https://img.shields.io/npm/v/remark-obsidian-md?color=blue&style=flat-square)](https://www.npmjs.com/package/remark-obsidian-md)
[![License](https://img.shields.io/npm/l/remark-obsidian-md?color=green&style=flat-square)](LICENSE)

**[remark](https://github.com/remarkjs/remark)** plugin that ports **[Obsidian.md](https://obsidian.md)** markdown syntax to standard, framework-agnostic MDAST.

## Contents

- [What is this?](#what-is-this)
- [Installation](#installation)
- [Recommended pipeline](#recommended-pipeline)
- [Usage](#usage)
- [Options](#options)
- [Per-feature plugins](#per-feature-plugins)
- [Features](#features)
- [Deliberately unsupported](#deliberately-unsupported)
- [Frontmatter helper](#frontmatter-helper)
- [Types](#types)
- [Migrating from 2.0.0 to 3.0.0](#migrating-from-200-to-300)
- [Credits](#credits)
- [License](#license)

## What is this?

Obsidian extends markdown with wiki links, embeds, callouts, highlights, comments and block references that no standard markdown parser understands. This plugin parses all of them into plain MDAST — using native nodes (`link`, `image`, `text`) wherever they exist and `data.hName` / `data.hProperties` everywhere else — so the output composes with `remark-rehype`, MDX, `remark-stringify` and any downstream stack, not just one.

It ships as:

- **`remarkObsidianMd`** (default export) — the composed plugin for the common case, taking one flat options object.
- **Per-feature plugins** — `remarkObsidianWikiLinks`, `remarkObsidianEmbeds`, `remarkObsidianHighlights`, `remarkObsidianCallouts`, `remarkObsidianComments`, `remarkObsidianBlockIds`, `remarkObsidianFootnotes` — when you want to compose the pipeline yourself.

Syntax that already has maintained plugins (GFM, math) is delegated to those plugins as peers; this package implements only the Obsidian complement.

## Installation

```bash
npm install remark-obsidian-md remark-gfm
# or
pnpm add remark-obsidian-md remark-gfm
# or
yarn add remark-obsidian-md remark-gfm
```

`remark-gfm` is a peer dependency: GFM tables, task lists, strikethrough and reference footnotes are intentionally not bundled. Add it to the pipeline before this plugin.

## Recommended pipeline

```text
remarkParse → remarkGfm → remarkObsidianMd → remarkRehype (or MDX)
```

`remarkGfm` runs first so wiki links inside table cells are transformed; `remarkObsidianMd` stays Obsidian-only; `remarkRehype` (or the MDX compiler) turns the MDAST into HTML. The two custom nodes this plugin emits (`embed`, `callout`) carry `hName` / `hProperties`, so `mdast-util-to-hast` renders them without a companion plugin.

```ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkObsidianMd, { filesystemResolver } from "remark-obsidian-md";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

const file = await unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkObsidianMd, {
    resolver: filesystemResolver("./vault"),
    urlPrefix: "/docs", // optional
  })
  .use(remarkRehype)
  .use(rehypeStringify)
  .process("[[My Note]] ==highlighted== > [!tip]");

console.log(String(file));
```

With **MDX** (e.g. Next.js, Fumadocs), use the same plugins in your `remarkPlugins` array — the plugin emits no MDX JSX nodes.

## Usage

```ts
import remarkObsidianMd, {
  filesystemResolver,
  mapResolver,
} from "remark-obsidian-md";
```

Pass a **Resolver** so wiki links and embeds can find their targets. Two are built in:

- `filesystemResolver(vault, { duplicatePolicy })` — scans a Vault directory once (lazily, cached). Notes are matched by path, basename and Alias; Assets by path and filename. Matching is case-insensitive, the `.md` extension is optional, and duplicate basenames resolve **root-wins** by default, matching Obsidian.
- `mapResolver(map)` — an in-memory `{ "Note": { path, title?, aliases?, cssclasses? } }` map, for when your content already lives somewhere else (a CMS, an in-memory index, tests). Duplicate basenames resolve root-wins, like the filesystem Resolver.

Without a `resolver`, every target is unresolved and links render with the unresolved strategy (see [Options](#options)).

## Options

The composed plugin takes one flat options object:

```ts
import type { RemarkObsidianMdOptions } from "remark-obsidian-md";
```

| Option                             | Type                                        | Default              | Description                                                                                                   |
| :--------------------------------- | :------------------------------------------ | :------------------- | :------------------------------------------------------------------------------------------------------------ |
| `resolver`                         | `Resolver`                                 | empty map            | Resolves Link Targets: `filesystemResolver(vault)` or `mapResolver(map)`. Without one, nothing resolves.       |
| `slugify`                          | `(text: string) => string`                 | built-in slugify     | Converts a path segment to a URL segment. Symbols after a word are spelled out (`C++` → `c-plus-plus`, `C#` → `c-sharp`). |
| `slugifyPath`                      | `(path: string) => string`                 | –                    | Maps a Note path to the slug it is published under. Use `createSlugifyPath` to keep Notes that slugify alike apart. |
| `urlPrefix`                        | `string`                                   | `""`                 | Prepended to every generated URL (e.g. `"/docs"`).                                                             |
| `wikiLinks.unresolvedStrategy`     | `"link" \| "plain"`                         | `"link"`             | `"link"` renders `<a class="is-unresolved">`; `"plain"` renders the label as text.                             |
| `wikiLinks.slugger`                | `(text: string) => string`                 | GitHub-style slugs    | Slugs heading anchors.                                                                                        |
| `embeds.readNote`                  | `(path: string) => string \| undefined`    | –                    | Reads a Note's markdown by its resolved path; required for transclusion.                                       |
| `embeds.maxDepth`                  | `number`                                    | `4`                  | Maximum transclusion nesting depth (cycle-guarded).                                                           |
| `blockIds.readNote`                | `(path: string) => string \| undefined`    | `embeds.readNote`    | Reads a Note's markdown for cross-Note Block References.                                                       |
| `callouts.types`                   | `Record<string, CalloutTypeDefinition>`    | canonical 13 types   | Register or override Callout types (`{ icon?, color?, title? }`). Unknown types fall back to `note`.            |

```ts
// Everything together
use(remarkObsidianMd, {
  resolver: filesystemResolver("./vault"),
  slugify: mySlugify,
  urlPrefix: "/docs",
  wikiLinks: { unresolvedStrategy: "plain" },
  embeds: { readNote: (path) => fs.readFileSync(path, "utf8"), maxDepth: 2 },
  blockIds: { readNote: sameReader },
  callouts: {
    types: {
      plant: { icon: "plant", color: "green", title: "Gardening" },
    },
  },
});
```

The built-in `slugify` spells `+` and `#` that follow a word, so `C++.md` → `c-plus-plus` and `C.md` → `c` get distinct URLs. It is not injective in general: names that differ only in other punctuation (say `A B.md` and `A-B.md`) still collide, and a site generator that requires unique URLs will reject them — pass your own `slugify` when a Vault has such names.

### Unique slugs

`createSlugifyPath` turns a list of Note paths into a `(path) => slug` map that gives every Note its own URL, even when two names slugify alike (`Sebá.md` and `Sebã.md` both want `seba`). The first Note of a colliding group keeps the plain slug, the others get `-2`, `-3`, …; a slug another Note already owns is never taken, and paths are sorted, so the assignment does not depend on scan order. An `index` Note is published under its folder — unless a Note with that name exists, in which case it moves to `<folder>/index`. Pass `{ slugify }` to use another slugifier; the default is the built-in one.

```ts
import { createSlugifyPath, filesystemResolver } from "remark-obsidian-md";

const resolver = filesystemResolver("./vault");
const slugifyPath = createSlugifyPath(resolver.paths);

use(remarkObsidianMd, { resolver, slugifyPath });
```

Pass the same map to your site generator, so a link and the Note it points at always agree. `getFrontmatter` takes it too:

```ts
const frontmatter = getFrontmatter(note.data.frontmatter, {
  resolver,
  slugifyPath,
});
```

## Per-feature plugins

Each per-feature plugin takes its own options and can be composed by hand instead of the default:

```ts
import {
  remarkObsidianWikiLinks,
  remarkObsidianEmbeds,
  remarkObsidianHighlights,
  remarkObsidianCallouts,
  remarkObsidianComments,
  remarkObsidianBlockIds,
  remarkObsidianFootnotes,
} from "remark-obsidian-md";
```

| Plugin                     | Options                                                                                |
| :------------------------- | :------------------------------------------------------------------------------------- |
| `remarkObsidianWikiLinks`  | `resolver`, `slugify`, `slugifyPath`, `slugger`, `urlPrefix`, `unresolvedStrategy`      |
| `remarkObsidianEmbeds`    | the Wiki Links options plus `readNote`, `maxDepth`                                     |
| `remarkObsidianHighlights` | –                                                                                       |
| `remarkObsidianCallouts`   | `types`                                                                                 |
| `remarkObsidianComments`   | –                                                                                       |
| `remarkObsidianBlockIds`   | –                                                                                       |
| `remarkObsidianFootnotes`  | –                                                                                       |

## Features

### Wiki Links

- `[[Note]]` → a link to the Note's published URL (slugified, `urlPrefix`-prefixed).
- `[[Note|Alias]]` → displays the Alias.
- `[[Note#Heading]]`, `[[#Heading]]` and `[[Note#H1#H2]]` → links to heading anchors (GitHub-style slugs by default).
- `[[Note#^block-id]]`, `[[#^block-id]]` → links to a Block Reference.
- Subpaths are validated: a heading Subpath whose heading cannot be found renders via the unresolved strategy. Same-Note Subpaths validate against the current Note; cross-Note Subpaths against the target's markdown when a reader (`blockIds.readNote` / `embeds.readNote`) is configured — without one, the link is kept.
- `[[Note\|Alias]]` inside a table cell still parses as an aliased link.
- Unresolved links render as `<a class="is-unresolved">` (or plain text) — never a broken link.
- Wiki links fire in every phrasing context (headings, lists, emphasis, table cells, callout bodies, transcluded content), are left alone inside code, and render literally inside standard link text.
- The Anchor Slugger defaults to GitHub-style slugs; override with `wikiLinks.slugger`.

### Embeds

- `![[Note]]` transcludes the whole Note; `![[Note#Heading]]` a section; `![[Note#^block-id]]` a single Block. An Alias on a Note Embed is ignored, like Obsidian: `![[Note|Alias]]` embeds the Note.
- Transcluded content lives in the `embed` node's `children`, so markdown inside it is processed as markdown (embedded wiki links, callouts and highlights work).
- The Embed container carries the embedded Note's CSS Classes; a lone Embed is promoted to a `div.internal-embed`, a mid-text Embed becomes a `span.internal-embed`.
- `![[image.png]]` renders an `<img>`, with `![[image.png|300]]` and `|300x200` sizing. `![[clip.mp3]]` / `![[clip.mp4]]` render `<audio>` / `<video>` leaves. PDF embeds fall back to a link carrying the `internal-embed` container class.
- Unresolved Embeds render a marked placeholder instead of disappearing.
- Embedding stops at `embeds.maxDepth` (default 4) and survives cycles (`A` → `B` → `A`); the stopped placeholder is marked `is-embed-limit`, not `is-unresolved`, since its target resolved fine.

### Highlights

`==text==` renders `<mark>text</mark>` in paragraphs, table cells and Callout bodies, but not inside code. Highlight colors (`==🔴red==`) are not transformed.

### Callouts

Callouts reproduce Obsidian's reading-view DOM: `> [!note]` becomes `div.callout[data-callout]`; foldable callouts (`> [!faq]-` / `+`) become `details.callout.is-collapsible[open]`. Aliases (`[!hint]`) map to canonical types (`tip`); unknown types fall back to `note`. The 13 canonical types ship built in; register custom types via `callouts.types`. Icons are `.callout-title-icon[data-icon]` — CSS decides the glyph, no inline SVGs.

### Comments

`%%inline%%` is removed (text after it stays). A line-start `%%` block, including multi-line blocks with blank lines and markdown, is removed whole. An unclosed `%%` hides the rest of the Note. `%%` inside code is left alone.

### Block IDs and Block References

A trailing `^id` (charset `[A-Za-z0-9-]`, preceded by whitespace) is stripped from output and the target block is annotated with `id="^id"`, so `[[Note#^id]]` links land. No Block IDs are auto-generated, matching Obsidian.

### Inline Footnotes

`^[text]` renders as `<sup>text</sup>` with no footnote section — a deliberate divergence from Obsidian (no definitions, no numbering).

## Deliberately unsupported

These features are intentionally out of scope, each with the plugin that covers it where one exists:

| Feature                              | Cover it with                                                                                              |
| :----------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| Tags (`#tag`)                        | Rendered as plain text; no maintained plugin — post-process yourself.                                       |
| GFM reference footnotes (`[^id]`)    | [`remark-gfm`](https://github.com/remarkjs/remark-gfm)                                                     |
| Highlight colors (`==🔴red==`)       | Not transformed; post-process or extend the Highlight transform.                                           |
| Math (`$…$`, `$$…$$`)                | [`remark-math`](https://github.com/remarkjs/remark-math) + [`rehype-katex`](https://github.com/remarkjs/remark-math) |
| Code blocks / syntax highlighting   | `remark-rehype` + [`rehype-highlight`](https://github.com/remarkjs/remark-rehype) or Shiki                  |
| Mermaid diagrams                     | [`rehype-mermaid`](https://github.com/remcohaszing/rehype-mermaid)                                         |
| Canvas / Bases                       | Obsidian proprietary formats; no markdown plugin can cover them.                                           |
| Search embeds (`![[search]]`)        | Obsidian proprietary; no plugin.                                                                           |
| HTML rendering inside markdown       | [`rehype-raw`](https://github.com/rehypejs/rehype-raw)                                                    |
| Dataview inline fields               | No maintained plugin; process with the Dataview API before remark.                                         |
| Frontmatter parsing                  | [`remark-frontmatter`](https://github.com/remarkjs/remark-frontmatter) — this package's `getFrontmatter` consumes an already-parsed object |

## Frontmatter helper

Instead of rendering a built-in frontmatter component, the plugin exposes a pure helper, `getFrontmatter`, that resolves a parsed frontmatter object into a plain object you can render yourself.

Wiki links (`[[Note]]`), URLs and markdown links (`[label](https://example.com)`) are resolved to `{ url, label }` objects when the whole string value is a single link. Markdown links are treated as external references: the target is emitted verbatim, never resolved against the Vault. Arrays and nested objects are resolved recursively; wiki links whose target names no Note in the Vault come back as `{ label, unresolved: true }` so consumers can style them like Obsidian does; all other value types are returned unchanged.

Whole-value ISO dates and datetimes come back as `{ date, kind: "date" | "datetime" }` — the ISO string preserved verbatim, so formatting (locale-dependent) stays the consumer's job. A property declared `date`/`datetime` in Obsidian is tagged according to its declared type; an untyped property is tagged by shape; a property declared as any other type is never tagged. Only top-level scalar values are tagged — arrays and nested objects are left alone, like Obsidian's single-valued date properties. Pass the type map with `filesystemPropertyTypes`:

```ts
import {
  filesystemPropertyTypes,
  filesystemResolver,
  getFrontmatter,
} from "remark-obsidian-md";

const frontmatter = getFrontmatter(note.data.frontmatter, {
  resolver, // the same Resolver you pass to the plugin
  types: filesystemPropertyTypes("./vault"), // optional, reads .obsidian/types.json
  slugify, // optional
  slugifyPath, // optional, maps a Note path to the slug it is published under
  urlPrefix: "/docs", // optional
  ignoredKeys: ["secret"], // optional
});

// frontmatter.related === { url: "/docs/my-note", label: "My Note" }
// frontmatter.Escrito === { date: "2026-02-17T11:33", kind: "datetime" }
```

## Types

This package is fully typed with [TypeScript](https://www.typescriptlang.org). It exports `RemarkObsidianMdOptions`, `Resolver`, `FilesystemResolver`, `ResolvedTarget`, `NoteMetadata`, `MapResolverEntry`, `FilesystemResolverOptions`, `DuplicatePolicy`, `UnresolvedStrategy`, `UrlOptions`, `WikiLinksOptions`, `WikiLinksPluginOptions`, `EmbedsOptions`, `EmbedsPluginOptions`, `BlockIdsOptions`, `CalloutsPluginOptions`, `CalloutTypeDefinition`, `GetFrontmatterOptions`, `FrontmatterLink`, `FrontmatterDate`, `PropertyTypes`, `SlugifyPath`, `filesystemPropertyTypes` and `createSlugifyPath`.

The custom `embed` and `callout` nodes are registered in the `@types/mdast` maps via module augmentation.

## Migrating from 2.0.0 to 3.0.0

Version 3.0.0 is a breaking rewrite. The output is framework-agnostic MDAST — no MDX JSX nodes, no lock-in to Fumadocs.

- **`root` option → `resolver`.** The filesystem scan is no longer wired into the plugin. Pass `resolver: filesystemResolver("./vault")` (same scanning, case-insensitive, extension-optional, root-wins) or `resolver: mapResolver({ … })` for your own index. `getContentMap` / `contentMap` are gone.
- **`enable*` flags removed.** `enableWikiLinks`, `enableEmbeds`, `enableHighlights` etc. are gone. To omit a feature, compose the per-feature plugins yourself instead of the composed default.
- **`customProps` removed.** Nodes no longer take injected attributes from options. Custom nodes carry `data.hName` / `data.hProperties` (standard `mdast-util-to-hast` mechanism); post-process the MDAST to tweak properties.
- **`include` node removed.** Embeds are now the custom `embed` node whose `children` hold the transcluded content, so downstream plugins process it. Both custom nodes render through `remark-rehype` without a companion plugin.
- **`getFrontmatter` options changed.** `{ contentMap, urlPrefix, ignoredKeys }` is now `{ resolver, slugify?, slugifyPath?, urlPrefix?, ignoredKeys?, types? }` — pass the same Resolver you pass to the plugin. Unresolved wiki links now come back as `{ label, unresolved: true }` instead of a bare string, so consumers can style them like Obsidian; markdown links (`[label](url)`) are resolved to `{ url, label }` as external references; whole-value ISO dates come back as `{ date, kind }` objects instead of bare strings.
- **Optional `slugifyPath`.** The new `slugifyPath` option (and `createSlugifyPath` helper) gives Notes that slugify alike distinct URLs, e.g. `Sebá.md` → `seba` and `Sebã.md` → `seba-2`. It is opt-in: without it, URLs are unchanged. With it, an `index` Note is linked under its folder (`/notes` instead of `/notes/index`) — unless a Note with that name exists, in which case it moves to `/notes/index`.
- **Callouts are back.** 2.0.0 removed them; 3.0.0 renders Obsidian's reading-view DOM and the bundled `styles/*.css` is gone (the `styles` export was removed with it). Icon hooks are `.callout-title-icon[data-icon]`.
- **URLs for symbol-bearing Notes changed.** The built-in `slugify` now spells `+`/`#` that follow a word: `C++.md` (`c-plus-plus`) and `C#.md` (`c-sharp`) no longer collide with `C.md` (`c`). Other punctuation is still dropped, so a Vault whose names differ only in punctuation needs a custom `slugify`.
- **New syntax.** Comments (`%%…%%`), Block IDs / Block References (`^id`), inline Footnotes (`^[text]`), aliases, nested-heading Subpaths and Callout folding are now supported.
- **`remark-gfm` is a peer dependency.** Install it and put it before this plugin in the pipeline.
- **Images are supported again** as Asset embeds (`![[image.png|300x200]]`), plus `<audio>` / `<video>` for media files.

## Credits

Inspired by the Obsidian publishing community and the [remark](https://github.com/remarkjs/remark) ecosystem.

## License

This project is licensed under the **[MIT License](/LICENSE)**.
