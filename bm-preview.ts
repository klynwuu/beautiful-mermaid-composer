/**
 * Perplexity theme preview — a self-contained "HM" showcase page.
 *
 * Renders the Perplexity (2026) brand theme across every diagram type, in
 * both the light (Off White paper) and dark (Off Black) variants, using
 * Space Grotesk as the Google Fonts substitute for Perplexity Sans.
 *
 * Also includes a palette reference (core + brand tones + accents) and a
 * typography specimen so the theme can be fine-tuned against the brand
 * guidelines at live.standards.site/perplexity.
 *
 * Usage:
 *   bun run bm-preview.ts        # writes bm-preview.html
 *   bun run bm-preview.ts --serve  # also serves on :4567
 */

import { generateThemeRegistry } from './src/themes/generate.ts'
import { THEMES } from './src/theme.ts'

const SANS = 'Space Grotesk'

// ── Build the browser bundle (exposes window.__mermaid) ────────────────────
// The gallery is rendered client-side through the official-mermaid engine —
// the same path the editor uses — so the preview matches the live composer.
// (mermaid needs a DOM, so it can't run at build time in Bun.)
await generateThemeRegistry()
const bundleBuild = await Bun.build({
  entrypoints: [new URL('./src/browser.ts', import.meta.url).pathname],
  target: 'browser',
  minify: true,
})
if (!bundleBuild.success) {
  console.error('Bundle failed:', bundleBuild.logs)
  process.exit(1)
}
const bundleJs = await bundleBuild.outputs[0]!.text()

// ── Sample diagrams (one per supported type) ───────────────────────────────

const SAMPLES: Array<{ title: string; code: string }> = [
  {
    title: 'Flowchart',
    code: `graph TD
  A[User Query] --> B{Needs Search?}
  B -->|Yes| C[Web Index]
  B -->|No| D[LLM Answer]
  C --> E[Rank Sources]
  E --> F[Synthesize]
  D --> F
  F --> G[Cited Response]`,
  },
  {
    title: 'Sequence',
    code: `sequenceDiagram
  participant U as User
  participant P as Perplexity
  participant S as Search
  participant M as Model
  U->>P: Ask a question
  P->>S: Retrieve sources
  S-->>P: Top documents
  P->>M: Prompt + context
  M-->>P: Grounded answer
  P-->>U: Answer with citations`,
  },
  {
    title: 'State',
    code: `stateDiagram-v2
  [*] --> Idle
  Idle --> Searching: query
  Searching --> Ranking: results
  Ranking --> Answering: sources
  Answering --> Idle: response
  Answering --> [*]`,
  },
  {
    title: 'Class',
    code: `classDiagram
  class Query {
    +string text
    +intent()
    +embed()
  }
  class Source {
    +string url
    +float score
    +rank()
  }
  class Answer {
    +string body
    +Source[] citations
  }
  Query --> Source
  Source --> Answer`,
  },
  {
    title: 'ER',
    code: `erDiagram
  USER ||--o{ THREAD : starts
  THREAD ||--|{ QUERY : contains
  QUERY ||--o{ SOURCE : cites
  USER {
    string id
    string plan
  }
  QUERY {
    string text
    datetime asked
  }`,
  },
  {
    title: 'XY Chart',
    code: `xychart-beta
  title "Answer latency by stage (ms)"
  x-axis [Retrieve, Rank, Prompt, Generate, Cite]
  y-axis "Milliseconds" 0 --> 800
  bar [120, 90, 60, 640, 110]
  line [120, 210, 270, 910, 1020]`,
  },
]

// ── Palette reference (from the brand guidelines) ──────────────────────────

const CORE = [
  { name: 'True Turquoise', hex: '#20808D' },
  { name: 'Off Black', hex: '#091717' },
  { name: 'Off White', hex: '#FBFAF4' },
]
const TONES = [
  { name: 'Turquoise 100', hex: '#DEF7F9' },
  { name: 'Turquoise 200', hex: '#92DCE2' },
  { name: 'Turquoise 300', hex: '#35BDC8' },
  { name: 'Turquoise 400', hex: '#2CA0AB' },
  { name: 'Turquoise 600', hex: '#1A6872' },
  { name: 'Turquoise 700', hex: '#114F56' },
  { name: 'Turquoise 800', hex: '#0B363C' },
  { name: 'Turquoise 900', hex: '#081F22' },
]
const ACCENTS = [
  { name: 'Orange', hex: '#B2582D' },
  { name: 'Yellow', hex: '#9B6C22' },
  { name: 'Olive', hex: '#707C36' },
  { name: 'Warm Red', hex: '#BF505C' },
]

function swatches(items: Array<{ name: string; hex: string }>): string {
  return items
    .map(
      (c) => `
      <div class="swatch">
        <div class="chip" style="background:${c.hex}"></div>
        <div class="chip-name">${c.name}</div>
        <div class="chip-hex">${c.hex}</div>
      </div>`,
    )
    .join('')
}

// ── Render a gallery of all samples for one theme variant ──────────────────

// Emit empty cards tagged with their diagram source + variant. They are filled
// in the browser by the client render script below (renderGallery).
function gallery(themeKey: 'perplexity' | 'perplexity-dark'): string {
  const colors = THEMES[themeKey]!
  const variant = themeKey === 'perplexity' ? 'light' : 'dark'
  const cards = SAMPLES.map((s) => {
    return `
      <figure class="card">
        <figcaption>${s.title}</figcaption>
        <div class="svg-wrap" data-diagram data-variant="${variant}" data-code="${encodeURIComponent(s.code)}"></div>
      </figure>`
  }).join('')
  return `<div class="gallery" style="--card-bg:${colors.bg}">${cards}</div>`
}

// ── Assemble the page ──────────────────────────────────────────────────────

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Perplexity Theme — Beautiful Mermaid</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<style>
  :root {
    --paper: #FBFAF4;
    --ink: #091717;
    --turq: #20808D;
    --turq-100: #DEF7F9;
    --turq-700: #114F56;
    --muted: #5A7472;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: '${SANS}', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 64px 32px 96px; }
  header { border-bottom: 1px solid var(--turq-100); padding-bottom: 32px; margin-bottom: 8px; }
  .eyebrow {
    font-family: 'Space Mono', monospace;
    font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--turq); margin: 0 0 12px;
  }
  h1 {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 500; font-size: clamp(40px, 6vw, 72px);
    line-height: 1.02; margin: 0 0 16px; letter-spacing: -0.01em;
  }
  h1 em { font-style: italic; color: var(--turq); }
  .lede { font-size: 18px; max-width: 60ch; color: var(--muted); margin: 0; line-height: 1.5; }
  h2 {
    font-family: 'Fraunces', Georgia, serif; font-weight: 500;
    font-size: 30px; margin: 72px 0 8px; letter-spacing: -0.01em;
  }
  .section-note { color: var(--muted); margin: 0 0 28px; font-size: 15px; max-width: 64ch; }

  /* Palette */
  .palette { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 16px; }
  .swatch { }
  .chip { height: 72px; border-radius: 10px; border: 1px solid rgba(9,23,23,0.08); }
  .chip-name { font-size: 13px; font-weight: 500; margin-top: 8px; }
  .chip-hex { font-family: 'Space Mono', monospace; font-size: 12px; color: var(--muted); }

  /* Typography specimen */
  .type-stack { display: grid; gap: 22px; }
  .type-row { border-top: 1px solid var(--turq-100); padding-top: 18px; }
  .type-label { font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--turq); margin-bottom: 6px; }
  .spec-sans { font-family: '${SANS}', sans-serif; font-size: 34px; font-weight: 500; letter-spacing: -0.01em; }
  .spec-serif { font-family: 'Fraunces', serif; font-size: 34px; font-weight: 500; }
  .spec-mono { font-family: 'Space Mono', monospace; font-size: 26px; }
  .sub { color: var(--muted); font-size: 13px; margin-top: 4px; }
  .sub code { font-family: 'Space Mono', monospace; }

  /* Gallery */
  .variant-tag {
    display: inline-flex; align-items: center; gap: 8px;
    font-family: 'Space Mono', monospace; font-size: 12px; color: var(--muted);
    margin: 36px 0 16px;
  }
  .variant-tag .dot { width: 10px; height: 10px; border-radius: 50%; }
  .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 22px; }
  .card {
    margin: 0; border-radius: 16px; overflow: hidden;
    background: var(--card-bg);
    border: 1px solid rgba(9,23,23,0.10);
    box-shadow: 0 1px 2px rgba(9,23,23,0.04), 0 12px 32px -16px rgba(9,23,23,0.18);
  }
  figcaption {
    font-family: 'Space Mono', monospace; font-size: 11px; letter-spacing: 0.12em;
    text-transform: uppercase; padding: 14px 18px 0; color: var(--turq);
  }
  .svg-wrap { padding: 14px 18px 22px; display: flex; justify-content: center; }
  .svg-wrap svg { max-width: 100%; height: auto; }

  footer { margin-top: 80px; padding-top: 24px; border-top: 1px solid var(--turq-100); color: var(--muted); font-size: 13px; }
  footer code { font-family: 'Space Mono', monospace; }
  a { color: var(--turq); }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <p class="eyebrow">Beautiful Mermaid × Perplexity 2026</p>
      <h1>The <em>Perplexity</em> theme for Mermaid diagrams.</h1>
      <p class="lede">Off White paper, Off Black ink, and True Turquoise as the hero accent — rendered with Space Grotesk, the Google Fonts substitute for Perplexity Sans. Two variants, every diagram type, fully themeable via CSS variables.</p>
    </header>

    <h2>Color</h2>
    <p class="section-note">Core brand colors lead; turquoise tones map to lines, surfaces, and borders; warm accents stay in reserve. Mapped to the theme's <code style="font-family:'Space Mono',monospace">bg / fg / line / accent / muted / surface / border</code> roles.</p>
    <div class="palette">${swatches(CORE)}</div>
    <div style="height:24px"></div>
    <div class="palette">${swatches(TONES)}</div>
    <div style="height:24px"></div>
    <div class="palette">${swatches(ACCENTS)}</div>

    <h2>Typography</h2>
    <p class="section-note">Perplexity's type stack is proprietary (Grilli Type). These are the closest Google Fonts substitutes, free to embed.</p>
    <div class="type-stack">
      <div class="type-row">
        <div class="type-label">Sans · Perplexity Sans → Space Grotesk</div>
        <div class="spec-sans">Grotesque with nuance and personality</div>
        <div class="sub">Diagram default. <code>font: 'Space Grotesk'</code></div>
      </div>
      <div class="type-row">
        <div class="type-label">Serif · Perplexity Serif → Fraunces</div>
        <div class="spec-serif">A refined editorial touch &amp; contrast</div>
        <div class="sub">Display headings &amp; pull quotes.</div>
      </div>
      <div class="type-row">
        <div class="type-label">Mono · Perplexity Mono → Space Mono</div>
        <div class="spec-mono">condensed("but clear") // 0123456789</div>
        <div class="sub">Code, callouts, and labels.</div>
      </div>
    </div>

    <h2>Diagrams — Light</h2>
    <p class="section-note">Off White <code style="font-family:'Space Mono',monospace">#FBFAF4</code> paper with turquoise-tinted surfaces.</p>
    <div class="variant-tag"><span class="dot" style="background:#FBFAF4;border:1px solid rgba(9,23,23,.2)"></span> theme: perplexity</div>
    ${gallery('perplexity')}

    <h2>Diagrams — Dark</h2>
    <p class="section-note">Off Black <code style="font-family:'Space Mono',monospace">#091717</code> ground with brightened Turquoise 300 accent.</p>
    <div class="variant-tag"><span class="dot" style="background:#091717"></span> theme: perplexity-dark</div>
    ${gallery('perplexity-dark')}

    <footer>
      Generated by <code>bm-preview.ts</code> · rendered client-side via the official-mermaid engine · themes live in <code>src/themes/</code> · references:
      <a href="https://live.standards.site/perplexity/color">color</a>,
      <a href="https://live.standards.site/perplexity/type">type</a>.
    </footer>
  </div>

  <!-- Renderer bundle (exposes window.__mermaid) -->
  <script>${bundleJs}</script>
  <script>
    (function () {
      function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
      }
      ready(async function () {
        var M = window.__mermaid;
        var nodes = document.querySelectorAll('[data-diagram]');
        // Render sequentially: mermaid.initialize is global, so light/dark
        // variants must not race each other.
        for (var i = 0; i < nodes.length; i++) {
          var el = nodes[i];
          var code = decodeURIComponent(el.getAttribute('data-code'));
          var variant = el.getAttribute('data-variant');
          var colors = M.brandColors('perplexity', variant);
          try {
            var svg = await M.renderMermaidSVGAsync(code, Object.assign({}, colors, {
              font: ${JSON.stringify(SANS)},
              transparent: true,
              edgeStyle: 'curved',
              themeCss: M.themeCss ? M.themeCss('perplexity') : '',
            }));
            el.innerHTML = svg;
            var s = el.querySelector('svg');
            if (s) { s.style.maxWidth = '100%'; s.style.height = 'auto'; }
          } catch (e) {
            el.innerHTML = '<pre style="color:#b00;padding:12px;white-space:pre-wrap">' + String(e) + '</pre>';
          }
        }
      });
    })();
  </script>
</body>
</html>`

await Bun.write('bm-preview.html', html)
console.log('\x1b[32m✓\x1b[0m Wrote bm-preview.html')

if (process.argv.includes('--serve')) {
  // Try the preferred port; if it's busy, fall back to the next free one.
  let port = 4567
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      Bun.serve({
        port,
        fetch() {
          return new Response(html, { headers: { 'Content-Type': 'text/html' } })
        },
      })
      console.log(`\x1b[36m▶\x1b[0m Preview at \x1b[1mhttp://localhost:${port}\x1b[0m`)
      break
    } catch (e) {
      if ((e as { code?: string }).code === 'EADDRINUSE') {
        console.log(`\x1b[90m[serve]\x1b[0m port ${port} in use, trying ${port + 1}…`)
        port++
        continue
      }
      throw e
    }
  }
}
