# remark-obsidian-md

[![NPM Version](https://img.shields.io/npm/v/remark-obsidian-md?color=blue&style=flat-square)](https://www.npmjs.com/package/remark-obsidian-md)
[![License](https://img.shields.io/npm/l/remark-obsidian-md?color=green&style=flat-square)](LICENSE)

**[remark](https://github.com/remarkjs/remark)** plugin to support **[Obsidian.md](https://obsidian.md)** syntax (wiki links, callouts, highlights).

## Contents

- [What is this?](#what-is-this)
- [When should I use this?](#when-should-i-use-this)
- [Installation](#installation)
- [Features](#features)
  - [Wiki Links](#wiki-links)
  - [Callouts](#callouts)
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

It handles features unique to Obsidian, like **Wiki Links** (`[[Note]]`), **Embeds** (`![[Note]]`), **Callouts** (`> [!info]`), and **Highlights** (`==text==`), resolving them correctly against your file system so they work in static site generators like Next.js, Gatsby, or Astro.

## When should I use this?

Use this plugin if:

- You use **Obsidian.md** to write content and want to publish it to the web (e.g., a Digital Garden or Blog).
- You want to preserve Obsidian's internal linking graph (`[[Link]]`) without manually converting links to standard markdown (`[Link](./path/to/file.md)`).
- You use **Next.js**, **Fumadocs**, or **Contentlayer** and want to support Obsidian callouts and highlights out of the box.

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

#### Images & Resizing

Images support standard embedding and Obsidian's resizing syntax.

- `[[image.png]]` → Link to open just the image.
- `![[image.png]]` → Renders the image in the page.
- `[[image.png|300]]` → Renders the image with `width="300"`.

#### Note Embedding

Using `![[My Note]]` will embed the content of that note directly into the current page.

### Callouts

Supports standard Obsidian callouts (e.g., `> [!info] Title`).

- **Icons:** automatically applies Lucide icons matching the default Obsidian callouts types (info, tip, warning, etc.).
- **Customization:** You can overwrite icons or add new types via the `callouts` option.
- **Rendering:** By default, renders as HTML `div` blocks with `data-callout` attributes. You can opt-in to render as a MDX component `<Callout>` instead (see [`Options`](#options)).

#### Collapsable

Supports the fold syntax:

- `> [!info]+` (Open by default)
- `> [!info]-` (Collapsed by default)

### Highlights

Text wrapped in double equals `==highlighted text==` is transformed into an HTML `<mark>highlighted text</mark>` tag.

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
| `enableCallouts`      | `boolean`                  | `true`       | Enable parsing of `> [!type]` blocks.                                                              |
| `enableHighlights`    | `boolean`                  | `true`       | Enable parsing of `==highlight==`.                                                                 |
| `useMdxCallout`       | `boolean`                  | `false`      | If `true`, renders a `<Callout>` component instead of HTML `div`s. Useful for MDX.                 |
| `calloutCollapseIcon` | `string`                   | -            | Custom SVG for the Callout collapse icon.                                                          |
| `slugify`             | `(text: string) => string` | -            | Custom function to convert file names to URLs.                                                     |
| `callouts`            | `Record<string, string>`   | -            | Map of callout types to SVG icon strings. Use this to add custom icons.                            |
| `customProps`         | `object`                   | -            | Inject custom HTML attributes/classes into generated nodes (wikiLinks, callouts, highlights, etc). |
| `contentMap`          | `Map<string, Metadata>`    | -            | **Advanced:** Manually provide the map of files instead of scanning `root`.                        |

## Examples

### Custom Callout Icons

You can register your own callout types or overwrite existing ones by passing SVG strings.

```ts
use(remarkObsidianMd, {
  callouts: {
    "my-custom-type": "<svg>...</svg>", // Usage: `> [!my-custom-type] Title`
    note: "<svg>...</svg>", // Overwrites the default 'note' icon
  },
});
```

### Styling Callouts

You can import the default CSS styles included in the package:

```ts
import "remark-obsidian-md/styles/callouts.css";
import "remark-obsidian-md/styles/callouts-colors.css";

// if that doesn't work, try to import directly from the node modules
import "../../node_modules/styles/callouts.css";
import "../../node_modules/styles/callouts-colors.css";
```

Or manually style the elements. The plugin produces the following HTML structure for callouts:

- **Normal Callouts:**

```html
<div class="callout" data-callout="type">
  <div class="callout-title">
    <div class="callout-icon">
      <svg><!-- ... --></svg>
    </div>

    Callout Title
  </div>

  <p>Callout content</p>
</div>
```

- **Collapsable Callouts:**

```html
<details class="callout" data-callout="type" open>
  <summary class="callout-title">
    <div class="callout-icon">
      <svg><!-- ... --></svg>
    </div>

    Callout Title

    <div class="callout-collapse-icon">
      <svg><!-- ... --></svg>
    </div>
  </summary>

  <p>Callout content</p>
</details>
```

#### Custom Callout Colors

If you want to customize the callouts colors, you can easily do so by adding the following CSS styles:

```css
[data-callout="note"] {
  --callout-color: 2, 122, 255; /* rgb */
}
```

## Types

This package is fully typed with [TypeScript](https://www.typescriptlang.org).
It exports the additional type [`Options`](#nextjs--fumadocs).

The node types are supported in [`@types/mdast`](https://www.npmjs.com/package/@types/mdast) by default.

## Next Steps

- **YAML Frontmatter Handling:** Parse Wiki Links inside frontmatter fields (e.g., `related: "[[Another Note]]"`).

## Credits

- [Lucide](https://lucide.dev/): default callouts icons.

## License

This project is licensed under the **[MIT License](/LICENSE)**.
