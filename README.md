# remark-obsidian-md

[![NPM Version](https://img.shields.io/npm/v/remark-obsidian-md?color=blue&style=flat-square)](https://www.npmjs.com/package/remark-obsidian-md)
[![License](https://img.shields.io/npm/l/remark-obsidian-md?color=green&style=flat-square)](LICENSE)

**[remark](https://github.com/remarkjs/remark)** plugin to support **[Obsidian.md](https://obsidian.md)** syntax (wiki links, highlights).

## Contents

- [What is this?](#what-is-this)
- [When should I use this?](#when-should-i-use-this)
- [Installation](#installation)
- [Features](#features)
  - [Wiki Links](#wiki-links)
  - [Highlights](#highlights)
- [Usage](#usage)
  - [Unified / Remark](#unified--remark)
  - [Next.js / Fumadocs](#nextjs--fumadocs)
- [Options](#options)
- [Examples](#examples)
- [Types](#types)
- [Next Steps](#next-steps)
- [Credits](#credits)
- [License](#license)

## What is this?

This is a [remark](https://github.com/remarkjs/remark) plugin that transforms **Obsidian-specific markdown syntax** into standard compatible Markdown (MDAST) or HTML. It bridges the gap between your personal knowledge base and your web publisher.

It handles features unique to Obsidian, like **Wiki Links** (`[[Note]]`), **Embeds** (`![[Note]]`), and **Highlights** (`==text==`), resolving them correctly against your file system so they work in static site generators like Next.js, Gatsby, or Astro.

## When should I use this?

Use this plugin if:

- You use **Obsidian.md** to write content and want to publish it to the web (e.g., a Digital Garden or Blog).
- You want to preserve Obsidian's internal linking graph (`[[Link]]`) without manually converting links to standard markdown (`[Link](./path/to/file.md)`).
- You use **Next.js**, **Fumadocs**, or **Contentlayer** and want to support Obsidian highlights out of the box.

## Installation

```bash
npm install remark-obsidian-md
# or
pnpm add remark-obsidian-md
# or
yarn add remark-obsidian-md
```

## Features

### Wiki Links

The plugin scans your `root` directory to resolve file paths automatically. You don't need to know the relative path; just the filename is enough.

- **Standard:** `[[My File]]` → becomes a link to `/my-file` (slugified).
- **Headings:** `[[My File#Some Heading]]` or `[[#Some Heading]]` → links to the specific anchor in the page.

#### Aliasing

You can display custom text for a link using the pipe `|` separator.

- `[[My File|Click Here]]` → Renders a link pointing to `My File` but displaying "Click Here".

#### Note Embedding

Using `![[My Note]]` will embed the content of that note directly into the current page.

### Highlights

Text wrapped in double equals `==highlighted text==` is transformed into an HTML `<mark>highlighted text</mark>` tag.

### Frontmatter

Instead of rendering a built-in frontmatter component, the plugin exposes a
pure helper, `getFrontmatter`, that resolves a parsed frontmatter object (e.g.
the one fumadocs already provides) into a plain object you can render yourself.

Wiki links (`[[Note]]`) and URLs inside string values are resolved to
`{ url, label }` objects. The `url` is always **root-relative** (starts with
`/`), so it can be passed straight through fumadocs'
`createRelativeLink` (or rendered with any `<Link>` component). Unresolved wiki
links degrade gracefully to their label text. All other value types (boolean,
number, array, plain string) are returned unchanged.

```ts
import { getFrontmatter } from "remark-obsidian-md";

const frontmatter = getFrontmatter(page.data.frontmatter, {
  contentMap, // the same Map you pass to the plugin
  urlPrefix: "/docs", // optional
  ignoredKeys: ["secret"], // optional
});

// frontmatter.related === { url: "/docs/my-note", label: "My Note" }
```

This keeps link resolution in one place: render the returned object with your
own component (matching the way Obsidian.md displays properties), without
duplicating the plugin's slugify / content-map logic.

## Usage

### Unified / Remark

Use it as a standard plugin in your unified processor. You can provide the `root` directory so the plugin know how to resolve file paths (defaults to `./public/`).

```javascript
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkObsidianMd from "remark-obsidian-md";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

const file = await unified()
  .use(remarkParse)
  // Add the plugin here
  .use(remarkObsidianMd, {
    root: "./public/vault",
    // Add another options here
  })
  .use(remarkRehype)
  .use(rehypeStringify)
  .process("[[My Note]]");

console.log(String(file));
```

### Next.js / Fumadocs

If you are using **Fumadocs**, add the plugin to your source configuration.

```ts
// source.config.ts
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import remarkObsidianMd, { type Options } from "remark-obsidian-md";

export const content = defineDocs({
  dir: "./public/vault", // Your markdown content directory
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [
      [
        remarkObsidianMd,
        {
          root: "./public/vault",
          // Optional: Add a prefix if your docs live under /docs
          urlPrefix: "/docs",
        } satisfies Options,
      ],
    ],
  },
});
```

## Options

| Option                | Type                       | Default      | Description                                                                                        |
| :-------------------- | :------------------------- | :----------- | :------------------------------------------------------------------------------------------------- |
| `root`                | `string`                   | `"./public"` | Directory path where your Obsidian vault/markdown files are located.                               |
| `urlPrefix`           | `string`                   | `undefined`  | A string to prepend to all generated URLs (e.g., `"/docs"`).                                       |
| `enableWikiLinks`     | `boolean`                  | `true`       | Enable parsing of `[[Wiki Links]]`.                                                                |
| `enableEmbeds`        | `boolean`                  | `true`       | Enable parsing of `![[Embeds]]`.                                                                   |
| `enableHighlights`    | `boolean`                  | `true`       | Enable parsing of `==highlight==`.                                                                 |
| `slugify`             | `(text: string) => string` | -            | Custom function to convert file names to URLs.                                                     |
| `customProps`         | `object`                   | -            | Inject custom HTML attributes/classes into generated nodes (wikiLinks, highlights).                |
| `contentMap`          | `Map<string, Metadata>`    | -            | **Advanced:** Manually provide the map of files instead of scanning `root`.                        |

## Examples

### Custom Styling

The plugin produces standard HTML elements you can style freely. Wiki links
render as `<a>` elements, highlights as `<mark>`, and embeds as `<include>`
elements resolved against your file system.

## Types

This package is fully typed with [TypeScript](https://www.typescriptlang.org).
It exports the additional type [`Options`](#nextjs--fumadocs).

The node types are supported in [`@types/mdast`](https://www.npmjs.com/package/@types/mdast) by default.

## Migrating to 2.0.0

Version 2.0.0 is a breaking release:

- **Images removed.** Image handling (`![[image.png]]`, image links, dimensions)
  is no longer provided — image embedding is handled by fumadocs / your MDX
  pipeline. The `image-size` dependency and the `publicFolder` option were
  removed. `ContentMetadata` is now markdown-only (`type: "md"`).
- **Built-in frontmatter component removed.** The `enableFrontmatter` option and
  the injected `<details>` frontmatter component are gone. Use the new
  `getFrontmatter(frontmatter, { contentMap })` helper to obtain a resolved
  frontmatter object and render it with your own component.
- **Callouts removed.** Callout rendering (`> [!type]`) is now handled natively
  by Fumadocs. The `callouts` / `calloutCollapseIcon` / `useMdxCallout` /
  `enableCallouts` options and the `customProps.callouts` block were removed,
  along with the bundled `styles/callouts.css` and `styles/callouts-colors.css`.
- **Removed options / `customProps`:** `enableFrontmatter`,
  `ignoredFrontmatterKeys`, `customProps.frontmatter`, `customProps.imageLinks`,
  `customProps.imageEmbeds`, `enableCallouts`, `useMdxCallout`,
  `calloutCollapseIcon`, `callouts`, and `customProps.callouts`.

## Credits

## License

This project is licensed under the **[MIT License](/LICENSE)**.
