# remark-obsidian-md

[![NPM Version](https://img.shields.io/npm/v/remark-obsidian-md?color=blue&style=flat-square)](https://www.npmjs.com/package/remark-obsidian-md)
[![License](https://img.shields.io/npm/l/remark-obsidian-md?color=green&style=flat-square)](LICENSE)

A robust [Remark](https://remark.js.org) plugin to parse **Obsidian-flavored Markdown** for the [Unified](https://unifiedjs.com) ecosystem.

Designed for static site generators like [Next.js](https://nextjs.org) and documentation frameworks like [Fumadocs](https://fumadocs.vercel.app), this plugin allows you to write content in Obsidian and render it perfectly on the web—handling Wiki Links, recursive note embedding, and image resizing effortlessly.

## Features & Syntax

This plugin bridges the gap between Obsidian's syntax and standard web Markdown.

### Wiki Links

Link to other notes without needing absolute paths or URL encoding.

- `[[Note Name]]` → `<a href="/content/note-name">Note Name</a>`
- `[[Note Name|Custom Label]]` → `<a href="...">Custom Label</a>`
- `[[Note Name#Heading]]` → Link to a specific heading in another note.
- `[[#Local Heading]]` → Anchor link to a heading on the current page.

### Images & Resizing

Standard Obsidian image syntax is fully supported, including resizing syntax which is converted to standard HTML attributes.

- `![[image.png]]` → Standard image embed.
- `![[image.png|Alt Text]]` → Image with Alt Text.
- `![[image.png|300]]` → Image resized to **300px width** (preserves aspect ratio).

### Note Embedding (Transclusion)

Embed the content of one note inside another. The plugin recursively parses the embedded content, ensuring links and images inside the embedded note work correctly.

- `![[My Page]]` → Inlines the entire content of "My Page" into the current document.

## Installation

```bash
npm install remark-obsidian-md
# or
pnpm add remark-obsidian-md
# or
yarn add remark-obsidian-md
```

## Usage

### 1. Basic Usage (Unified/Remark)

To work efficiently, this plugin builds a **Content Map** — a dictionary mapping lowercase filenames (e.g., "my note") to their metadata (path, dimensions). By default, it scans the `root` directory to build this map automatically.

```ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import remarkObsidianMd from "remark-obsidian-md";

const processor = unified()
  .use(remarkParse)
  .use(remarkObsidianMd, {
    // Root folder to scan for files and resolve embeds
    root: "./public",
  })
  .use(remarkRehype)
  .use(rehypeStringify);

const file = await processor.process(
  "Read [[My Note]] or see ![[image.png|200]]",
);

console.log(String(file));
```

### 2. Usage with Next.js / Fumadocs

This plugin was designed to work with Fumadocs. Add it to your `source.config.ts` to enable Obsidian syntax across your documentation.

```ts
// source.config.ts
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import remarkObsidianMd, { type PluginOptions } from "remark-obsidian-md";

export const content = defineDocs({
  dir: "./public", // Your markdown content directory
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [
      [remarkObsidianMd, { root: "./public" } satisfies PluginOptions],
    ],
  },
});
```

## Options

### The `ContentMetadata` Interface

If you provide a custom `getContentMap` function, your map values must match this interface:

```ts
type ContentMetadata = {
  path: string; // The resolved URL or file path (relative to root)
  type: "md" | "img"; // The type of content
  width?: number; // Width (Required for images to support Next.js Image optimization)
  height?: number; // Height (Required for images)
};
```

## Roadmap & Next Steps

We are actively working on making this the ultimate Obsidian adapter for the web.

- **YAML Frontmatter Handling:** Parse Wiki Links inside frontmatter fields (e.g., `related: "[[Another Note]]"`).
- **Smart Embed Cleaning:** Automatically strip YAML frontmatter from embedded notes.
- **Section Transclusion:** Support `![[My Page#Section]]` to embed **only** a specific section of a note (from the heading down to the next heading of the same level).
- **Obsidian Callouts:** Native support for Obsidian's `> [!INFO]` callout syntax.

## License

This project is licensed under the **[MIT License](/LICENSE)**.
