<div align="center">

# beautiful-mermaid-composer

**Turn Mermaid diagrams into beautiful, brand-themed, social-ready images.**

A single-file live composer: write Mermaid on the left, get a polished diagram on the right — pick a brand theme, choose a font, curve the connectors, drop it on a background image, drag/resize it into place, and export a pixel-perfect PNG (or SVG, or copy-paste ASCII).

![img](/demo.gif)

</div>

---

## Why

[Mermaid](https://mermaid.js.org/) is the standard for text-based diagrams, but the default output isn't something you'd put in a deck, a blog header, or a social post. This composer wraps a fast, themeable renderer in a small editor focused on **making diagrams look good and exporting them at the right size** — no design tool round-trip.

It's built on a (modified) copy of [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid)'s rendering engine, with brand theming, curved connectors, and a layout/export workflow added on top.

## Features

- 🎨 **Brand themes** — a registry of complete visual identities (colors + recommended font), each with a light and dark variant. Ships with **Perplexity**; adding your own is one object (see below).
- 🔤 **Font picker** — Inter, Instrument Sans/Serif, Jersey 10, Parisienne, Pixelify Sans, VT323 (Google Fonts), plus each brand's recommended face.
- 〰️ **Curved or sharp connectors** — smooth, non-overshooting rounded routing à la draw.io's "curved" line style.
- 🖼️ **Background image** — drop in a local image; it's cover-cropped to the frame and shown live (WYSIWYG).
- 🧲 **Place the diagram like a design tool** — drag it anywhere, resize proportionally from the corners (opposite corner anchored), with **Figma-style center/edge snapping guides**, **arrow-key nudging** (1px / 10px with Shift), and double-click to re-center.
- 📐 **Social export presets** — Fit / 1:1 / 3:4 / 4:3 / 16:9 / 9:16 at a 1080 base, with an optional **transparent** background (any ratio) and a subtle **drop shadow**.
- ⌨️ **ASCII output** — render any diagram as copyable Unicode box-art for terminals, code comments, or chat.
- 💾 **Export** — Download PNG (honors your exact placement at full resolution), Download SVG (clean vector), Copy SVG, Copy ASCII.
- 📦 **Self-contained output** — the build produces one HTML file with the renderer inlined; open it directly, no server needed.

## Requirements

- [Bun](https://bun.sh) (used for bundling and the dev server)

## Quick start

```bash
git clone <your-repo-url> beautiful-mermaid-composer
cd beautiful-mermaid-composer
bun install

# Build + serve the editor on http://localhost:4568
bun run editor
```

Open **http://localhost:4568** and start composing.

Prefer no server? Build the standalone page and open the file:

```bash
bun run build:editor      # writes bm-editor.html
open bm-editor.html   # macOS — or just double-click it
```

The generated `.html` is fully self-contained (the renderer is bundled in; only Google Fonts load from the network).

### Scripts

| Command | What it does |
|---|---|
| `bun run editor` | Build **and** serve the editor on `:4568` |
| `bun run preview` | Build **and** serve the theme showcase on `:4567` |
| `bun run build` | Build both `bm-editor.html` and `bm-preview.html` |
| `bun run build:editor` | Build just the editor HTML |

## Using the editor

1. **Type** Mermaid source in the left pane (flowchart, sequence, state, class, ER, or XY chart).
2. **Theme / Font / Curved** — set the look in the top bar.
3. **Ratio** — pick an export size. On any fixed ratio, the diagram becomes a movable object:
   - **drag** to reposition, **corner handles** to resize proportionally,
   - magenta **guides** snap it to the frame's center/edges,
   - **arrow keys** nudge it (Shift = 10px), **double-click** to re-center.
4. **Background** — optionally upload a local image (cover-fit behind the diagram).
5. **Transparent / Shadow** — toggle as needed.
6. **Export** — Download PNG / SVG, or Copy SVG. Switch to **ASCII** to copy box-art.

## Adding a brand theme

Themes live in [`src/brands.ts`](src/brands.ts). A brand is one object — colors for light + dark and a recommended font:

```ts
const ACME: BrandTheme = {
  id: 'acme',
  label: 'Acme',
  font: 'Inter',                 // a Google font (added to the picker automatically)
  light: {
    bg: '#FFFFFF', fg: '#111111',
    line: '#888', accent: '#2D7FF9', muted: '#667', surface: '#EEF3FF', border: '#CFE0FF',
  },
  dark: {
    bg: '#0B0B0B', fg: '#FAFAFA',
    line: '#555', accent: '#5C9DFF', muted: '#99A', surface: '#15233D', border: '#244',
  },
}
// add ACME to the BRANDS array
```

Rebuild (`bun run build:editor`) and it appears in the **Theme** dropdown as `Acme · Light` / `Acme · Dark`, with its font auto-loaded.

**Color roles:** `bg` background · `fg` text · `line` connectors · `accent` arrow heads/highlights · `muted` secondary text & labels · `surface` node fill · `border` node stroke. Only `bg` + `fg` are required — the rest fall back to derived values.

## Programmatic use

The bundled engine is a normal TypeScript library under `src/` — you can import it directly:

```ts
import { renderMermaidSVG, renderMermaidASCII } from './src/index.ts'
import { THEMES } from './src/theme.ts'
import { diagramColorsToAsciiTheme } from './src/ascii/index.ts'

// SVG with the Perplexity theme + curved connectors
const svg = renderMermaidSVG('graph TD\n  A --> B --> C', {
  ...THEMES['perplexity'],
  font: 'Space Grotesk',
  edgeStyle: 'curved',           // 'sharp' (default) | 'curved'
})

// ASCII (plain text, copyable)
const ascii = renderMermaidASCII('graph LR; A --> B --> C', {
  theme: diagramColorsToAsciiTheme(THEMES['perplexity-dark']),
  colorMode: 'none',
})
```

## Project structure

```
bm-editor.ts             # generates the live composer (bm-editor.html)
bm-preview.ts            # generates the theme showcase (bm-preview.html)
src/
  brands.ts              # brand theme registry (add identities here)
  theme.ts               # color theme system + CSS-variable derivation
  browser.ts             # browser entry — exposes the API on window.__mermaid
  index.ts               # renderMermaidSVG / renderMermaidSVGAsync
  ascii/                 # ASCII / Unicode renderer
  renderer.ts            # SVG renderer (incl. curved-connector paths)
  layout-engine.ts       # ELK-based layout
  sequence/ class/ er/ xychart/   # per-diagram parsers, layout, renderers
```

## Credits

- Rendering engine: [**beautiful-mermaid**](https://github.com/lukilabs/beautiful-mermaid) by Craft Docs (MIT) — bundled here in modified form.
- ASCII engine lineage: [**mermaid-ascii**](https://github.com/AlexanderGrooff/mermaid-ascii) by Alexander Grooff.
- Diagram syntax: [**Mermaid**](https://mermaid.js.org/).
- The Perplexity theme is an unofficial interpretation of Perplexity's public brand guidelines, using free Google Fonts substitutes for its proprietary type stack. Not affiliated with or endorsed by Perplexity.

## License

[MIT](LICENSE) © 2026 klynwuu. See `LICENSE` for bundled-component notices.
