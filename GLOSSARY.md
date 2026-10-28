# remark-obsidian-md

A remark plugin that ports Obsidian.md's markdown syntax into standard MDAST, so Obsidian Vaults can be published by any unified pipeline.

## Vault & notes

**Vault**:
The root directory of Notes and Assets that Wiki Links and Embeds are resolved against.
_Avoid_: content directory, docs folder, public folder

**Note**:
A single markdown file within a Vault.
_Avoid_: page, document, file

**Asset**:
A non-markdown file in a Vault (image, PDF, audio) that can be embedded but not linked as a Note.
_Avoid_: media, attachment, resource

## Publishing

**Slug**:
The path a Note is published under, built from its path segments (e.g. `Geografia/Localizações/Sebá.md` → `geografia/localizacoes/seba`). Every Note of a Vault gets its own.
_Avoid_: route, page path, permalink

## Links & embeds

**Wiki Link**:
Obsidian's `[[…]]` construct for referring to a Note or Asset.
_Avoid_: wikilink, internal link, backlink

**Link Target**:
The part of a Wiki Link or Embed that names the Note or Asset, before any Subpath.
_Avoid_: path, href, destination

**Subpath**:
The `#Heading` or `#^block-id` suffix of a Link Target that selects a part of the target instead of the whole.
_Avoid_: anchor, fragment, hash

**Alias**:
Display text that overrides the target's name, written after a `|` in a Wiki Link.
_Avoid_: label, text, title

**Embed**:
The `![[…]]` construct that renders the target's content in place instead of linking to it.
_Avoid_: transclusion, include

## Inline syntax

**Highlight**:
Text wrapped in `==…==`, whose content is parsed as inline Markdown.
_Avoid_: mark, marker, selection

**Highlight Color**:
Color a Highlight carries, set by a color emoji at the start of the Highlight's content.
_Avoid_: color, colour, swatch, style

**Comment**:
Text wrapped in `%%…%%` and omitted from rendered output.
_Avoid_: annotation, note

**Footnote**:
A short note written inline at the point it annotates, using `^[text]`, whose content is parsed as inline Markdown.
_Avoid_: endnote, reference

## Blocks

**Block ID**:
A `^id` marker at the end of a block that names it for later reference.
_Avoid_: block anchor, block name

**Block Reference**:
A Wiki Link or Embed whose Subpath is a Block ID (e.g. `[[Note#^id]]`).
_Avoid_: block link

**Callout**:
A blockquote whose first line begins `> [!type]`, rendered as a styled, optionally foldable block.
_Avoid_: admonition, alert, aside

## Metadata

**Frontmatter**:
The YAML metadata block at the top of a Note, surfaced in Obsidian as Properties.
_Avoid_: metadata, YAML header

**CSS Class**:
A class name listed in a Note's `cssclasses` Frontmatter property, applied to that Note's rendered container and carried along when the Note is embedded.
_Avoid_: style, theme class
