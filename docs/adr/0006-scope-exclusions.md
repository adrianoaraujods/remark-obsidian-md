# Deliberate scope exclusions

The port intentionally does **not** implement tags, GFM-style reference footnotes, highlight colors, math, code blocks, mermaid, canvas, bases, search embeds, HTML rendering inside markdown, Dataview inline fields, or frontmatter parsing (a parsed object is consumed instead). Obsidian's inline footnote `^[text]` *is* supported, but renders as literal `<sup>text</sup>` with no footnote section — an explicit divergence from Obsidian, which shows a numbered marker and a footnote list.

## Consequences

Each exclusion is documented in the README with the plugin that covers it, where one exists. Adding any of them later is additive, not a reversal of the resolver or output model.
