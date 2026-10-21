# Delegate covered syntax to peers; implement only the complement

Features already covered by maintained plugins — GFM tables, task lists, strikethrough and reference footnotes; math — are delegated to those plugins, declared as `peerDependencies` and documented in the recommended pipeline. The package implements only the Obsidian-specific complement (Wiki Links, Embeds, Highlights, Callouts, Comments, Block IDs, inline Footnotes). Bundling the external plugins was rejected because it forces parsing on every consumer, couples versions, and duplicates rendering that already lives in core `remark-rehype`.

## Consequences

The README documents a recommended pipeline and, for every deliberately unsupported feature, the plugin that covers it.
