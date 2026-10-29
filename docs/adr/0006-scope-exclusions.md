# Deliberate scope exclusions

The port intentionally does **not** implement tags, GFM-style reference footnotes, math, code blocks, mermaid, canvas, bases, search embeds, HTML rendering inside markdown, Dataview inline fields, or frontmatter parsing (a parsed object is consumed instead). The frontmatter-parsing exclusion covers the published-output pipeline and the `getFrontmatter` helper, which consumes an already-parsed object; the filesystem Resolver necessarily reads a Note's frontmatter to collect its Aliases and CSS Classes. Obsidian's inline footnote `^[text]` *is* supported: its content is parsed as inline Markdown, so a Wiki Link inside it resolves against the Vault as it does anywhere else in the Note, and it renders as `<sup>…</sup>` with no footnote section — an explicit divergence from Obsidian, which shows a numbered marker and a footnote list. Highlight colors are supported too: Obsidian 1.14's syntax — a color emoji at the start of a Highlight's content — sets the Highlight Color, which the marked element carries as `data-highlight`, so a consumer themes the six colors through the attribute.

## Consequences

Each exclusion is documented in the README with the plugin that covers it, where one exists. Adding any of them later is additive, not a reversal of the resolver or output model.
