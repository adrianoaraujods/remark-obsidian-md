# Emit framework-agnostic MDAST, never MDX or HTML

Obsidian syntax is transformed into standard MDAST, using `data.hName`/`hProperties` for elements that have no native node, and never into MDX JSX nodes or pre-rendered HTML. The plugin must compose with any unified pipeline (`remark-rehype`, MDX, `remark-stringify`); the 2.x `include` node leaked an `mdxJsxTextElement` and locked output to Fumadocs, which is why it is removed. Custom node types (`embed`, `callout`) carry `hName`/`hProperties` so `mdast-util-to-hast`'s unknown-handler renders them without a companion plugin.

## Considered options

- **MDX-first** (emit `mdxJsx*` nodes): renders React components directly but only works in an MDX pipeline.
- **hast/HTML-first** (a rehype plugin): bypasses remark entirely and cannot compose with remark-to-remark transforms.
