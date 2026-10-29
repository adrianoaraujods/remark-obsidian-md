# Embeds hide Note Frontmatter by default

An embedded Note hides its Frontmatter by default. The plugin strips the Frontmatter block out of the embedded Note's source right after reading it and before parsing it, so none of it reaches the output: whole-Note Embeds, section Embeds, Block ID Embeds and nested Embeds are all clean, and the YAML no longer leaks into the page as horizontal rules and a setext heading. A `showFrontmatter` option (default `false`, shared by `remarkObsidianEmbeds` and `remarkObsidianMd`) turns the Frontmatter back on for a whole-Note Embed, rendering it as a YAML code block at the top of the embed, exactly as written in the Note; section and Block ID Embeds strip it silently, in both option states, because a partial Embed renders a fragment of the Note, not its properties.

Detection is deliberately conservative: the Note's first line must be exactly `---` (a leading byte-order mark is tolerated) and the text between the fences must parse into a plain object. Anything else — no closing fence, invalid YAML, YAML that is not a mapping, an empty `---` / `---` pair — is not Frontmatter, and the source is left untouched.

This extends, without contradicting, [ADR 0006](./0006-scope-exclusions.md): that ADR excludes Frontmatter parsing from the published-output pipeline and from `getFrontmatter`, which consumes an already-parsed object, while the filesystem Resolver must read a Note's Frontmatter to collect its Aliases and CSS Classes. This change adds Frontmatter handling only inside Embed expansion and never parses Frontmatter for the published output of a top-level Note — top-level Notes keep their Frontmatter as a consumer concern.

## Considered options

- **GitHub-style properties table**: rejected because mdast's native `table` always yields a `<thead>`, with the first row as `<th>`; GitHub's key/value layout is therefore not expressible without custom nodes, and nested values would need recursion on top of that.
- **Native YAML code block**: chosen because it keeps the tree native and stringifiable — no custom node type, no new dependency (`js-yaml` is already one), and `remark-stringify` keeps working.

## Consequences

Existing consumers who embed Notes with Frontmatter see changed output: the YAML no longer leaks, which is the intended fix. `showFrontmatter: true` brings the content back in a different shape. The embedded Note's CSS Classes keep applying to the embed container, and the resolver keeps reading Aliases and CSS Classes from Frontmatter, so nothing about resolution changes.
