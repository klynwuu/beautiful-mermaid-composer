/**
 * Beautiful Mermaid Composer — a self-contained live editor.
 *
 * Single HTML file (renderer bundled inline). Features:
 *   - Theme dropdown built from the brand registry (src/brands.ts) — add a
 *     brand there and it appears here automatically (light + dark per brand).
 *   - Diagram font picker (Google Fonts).
 *   - Curved vs sharp connectors.
 *   - SVG / ASCII output (ASCII is copyable plain text).
 *   - Optional local background image (centered, cover) — shown live (WYSIWYG).
 *   - Export to social dimensions: Fit / 1:1 / 3:4 / 4:3 / 16:9 / 9:16 at a
 *     1080 base, with a Transparent toggle that works for any ratio.
 *   - Download SVG / PNG, Copy SVG, Copy ASCII.
 *
 * Usage:
 *   bun run bm-editor.ts          # writes bm-editor.html
 *   bun run bm-editor.ts --serve  # also serves on :4568
 */

import { BRANDS } from './src/brands.ts'

// ── Build the browser bundle (exposes window.__mermaid) ────────────────────

const buildResult = await Bun.build({
  entrypoints: [new URL('./src/browser.ts', import.meta.url).pathname],
  target: 'browser',
  minify: true,
})
if (!buildResult.success) {
  console.error('Bundle failed:', buildResult.logs)
  process.exit(1)
}
const bundleJs = await buildResult.outputs[0]!.text()
console.log(`\x1b[36m›\x1b[0m Browser bundle: ${(bundleJs.length / 1024).toFixed(1)} KB`)

// ── Default sample diagram ─────────────────────────────────────────────────

const SAMPLE = `graph TD
  A[User Query] --> B{Needs Search?}
  B -->|Yes| C[Web Index]
  B -->|No| D[LLM Answer]
  C --> E[Rank Sources]
  E --> F[Synthesize]
  D --> F
  F --> G[Cited Response]`

// Fonts offered in the picker (loaded via the @import below).
const BASE_FONTS = [
  'Inter',
  'Instrument Sans',
  'Instrument Serif',
  'Jersey 10',
  'Parisienne',
  'Pixelify Sans',
  'VT323',
]

// Theme options: one Light + one Dark per registered brand.
const themeOptions = BRANDS.flatMap((b) => [
  `<option value="${b.id}::light">${b.label} · Light</option>`,
  `<option value="${b.id}::dark">${b.label} · Dark</option>`,
]).join('\n        ')

// Font options: base fonts plus any brand-recommended fonts.
const allFonts = Array.from(new Set([...BASE_FONTS, ...BRANDS.map((b) => b.font)]))
const fontOptions = allFonts.map((f) => `<option value="${f}">${f}</option>`).join('\n        ')

const defaultFont = BRANDS[0]?.font ?? 'Inter'

// ── The page ───────────────────────────────────────────────────────────────

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Beautiful Mermaid · Composer</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<style>
@import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Jersey+10&family=Parisienne&family=Pixelify+Sans:wght@400..700&family=VT323&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
</style>
<style>
  :root {
    --paper: #FBFAF4; --ink: #091717; --turq: #20808D;
    --turq-100: #DEF7F9; --line: #e7e4d8; --muted: #5A7472;
    --ui: 'Space Grotesk', system-ui, sans-serif;
    --mono: 'Space Mono', ui-monospace, monospace;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { font-family: var(--ui); color: var(--ink); background: var(--paper); display: flex; flex-direction: column; -webkit-font-smoothing: antialiased; }

  header, .toolbar { display: flex; align-items: center; gap: 14px 18px; flex-wrap: wrap; padding: 11px 18px; border-bottom: 1px solid var(--line); background: var(--paper); }
  .toolbar { background: #fffef9; padding-top: 9px; padding-bottom: 9px; }
  .brand { display: flex; align-items: baseline; gap: 8px; margin-right: auto; }
  .brand .dot { width: 12px; height: 12px; border-radius: 50%; background: var(--turq); transform: translateY(1px); }
  .brand b { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
  .brand span { font-family: var(--mono); font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.12em; }

  .ctrl { display: flex; align-items: center; gap: 7px; }
  .ctrl label { font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
  select, .btn { font-family: var(--ui); font-size: 13px; color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; cursor: pointer; transition: border-color .12s, background .12s; }
  select:hover, .btn:hover { border-color: var(--turq); }
  .btn.primary { background: var(--turq); color: #fff; border-color: var(--turq); }
  .btn.primary:hover { background: #1a6c78; }
  .btn:disabled { opacity: .4; cursor: not-allowed; }
  .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .seg button { border: 0; background: #fff; padding: 7px 12px; font-family: var(--mono); font-size: 12px; cursor: pointer; color: var(--muted); }
  .seg button.active { background: var(--turq); color: #fff; }
  .chk { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink); cursor: pointer; user-select: none; }
  .filename { font-family: var(--mono); font-size: 11px; color: var(--muted); max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sep { width: 1px; align-self: stretch; background: var(--line); margin: 2px 2px; }

  main { flex: 1; display: grid; grid-template-columns: minmax(280px, 36%) 1fr; min-height: 0; }
  .pane { min-height: 0; display: flex; flex-direction: column; }
  .pane.editor { border-right: 1px solid var(--line); }
  .pane-head { font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); padding: 10px 16px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; }
  textarea { flex: 1; resize: none; border: 0; outline: none; padding: 16px; font-family: var(--mono); font-size: 13px; line-height: 1.6; color: var(--ink); background: #fffef9; tab-size: 2; }

  .preview { flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; padding: 28px; background: var(--paper); transition: background .15s; }
  .frame { position: relative; box-shadow: 0 10px 40px -12px rgba(9,23,23,.35); border: 1px solid rgba(9,23,23,.08); background-size: cover; background-position: center; }
  .frame.plain { box-shadow: none; border-color: transparent; }
  .frame.checker { background-color: #fff; background-image: linear-gradient(45deg,#e6e6e6 25%,transparent 25%),linear-gradient(-45deg,#e6e6e6 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e6e6e6 75%),linear-gradient(-45deg,transparent 75%,#e6e6e6 75%); background-size: 22px 22px; background-position: 0 0,0 11px,11px -11px,-11px 0; }
  /* Frosted backdrop for "glass" themes: a duplicate of the frame's background
     image, blurred, then masked to the diagram's node shapes so node boxes read
     as frosted glass while the gaps stay sharp/clear. Sits under the SVG. */
  .frame-frost { position: absolute; inset: 0; pointer-events: none; z-index: 0; background-size: cover; background-position: center; filter: blur(14px) saturate(1.25); -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; mask-mode: alpha; }
  .frame-diagram { position: absolute; z-index: 1; }
  .frame-diagram.fit { inset: 18px; display: flex; align-items: center; justify-content: center; }
  .frame-diagram.fit svg { max-width: 100%; max-height: 100%; height: auto; }
  .frame-diagram:not(.fit) { cursor: move; outline: 1.5px solid rgba(32,128,141,.6); }
  .frame-diagram:not(.fit):focus { outline: 2px solid #20808D; }
  .frame-diagram:not(.fit) svg { width: 100%; height: 100%; display: block; }
  .frame-diagram.shadow svg { filter: drop-shadow(0 2px 7px rgba(9,23,23,.24)); }
  .handle { position: absolute; width: 12px; height: 12px; background: #fff; border: 1.5px solid #20808D; border-radius: 3px; box-shadow: 0 1px 2px rgba(0,0,0,.35); touch-action: none; z-index: 6; }
  .handle.nw { left: -6px; top: -6px; cursor: nwse-resize; }
  .handle.ne { right: -6px; top: -6px; cursor: nesw-resize; }
  .handle.sw { left: -6px; bottom: -6px; cursor: nesw-resize; }
  .handle.se { right: -6px; bottom: -6px; cursor: nwse-resize; }
  .guide { position: absolute; background: #FF2D78; pointer-events: none; display: none; z-index: 5; }
  .guide.v { width: 1px; top: 0; bottom: 0; }
  .guide.h { height: 1px; left: 0; right: 0; }
  pre.ascii { margin: 0; font-family: var(--mono); font-size: 13px; line-height: 1.32; white-space: pre; }
  .err { font-family: var(--mono); font-size: 12px; color: #b2582d; padding: 16px; }
  .toast { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%) translateY(20px); background: var(--ink); color: var(--paper); font-size: 13px; padding: 9px 16px; border-radius: 999px; opacity: 0; pointer-events: none; transition: all .2s; font-family: var(--mono); z-index: 10; }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
</style>
</head>
<body>
  <header>
    <div class="brand"><span class="dot"></span><b>Beautiful Mermaid</b><span>Composer</span></div>
    <div class="ctrl">
      <label>Theme</label>
      <select id="theme">
        ${themeOptions}
      </select>
    </div>
    <div class="ctrl">
      <label>Font</label>
      <select id="font">
        ${fontOptions}
      </select>
    </div>
    <label class="chk"><input type="checkbox" id="curved" checked /> Curved</label>
    <div class="seg" id="mode">
      <button data-mode="svg" class="active">SVG</button>
      <button data-mode="ascii">ASCII</button>
    </div>
  </header>

  <div class="toolbar" id="toolbar-svg">
    <div class="ctrl">
      <label>Ratio</label>
      <select id="ratio">
        <option value="fit">Fit diagram</option>
        <option value="1:1">Square · 1:1 · 1080²</option>
        <option value="3:4">Portrait · 3:4 · 1080×1440</option>
        <option value="4:3">Landscape · 4:3 · 1440×1080</option>
        <option value="16:9">Wide · 16:9 · 1920×1080</option>
        <option value="9:16">Story · 9:16 · 1080×1920</option>
      </select>
    </div>
    <label class="chk"><input type="checkbox" id="transparent" /> Transparent</label>
    <label class="chk"><input type="checkbox" id="shadow" checked /> Shadow</label>
    <div class="sep"></div>
    <div class="ctrl">
      <label>Background</label>
      <button class="btn" id="bg-upload">Upload image</button>
      <span class="filename" id="bg-name"></span>
      <button class="btn" id="bg-clear" style="display:none">Clear</button>
      <input type="file" id="bg-file" accept="image/*" style="display:none" />
    </div>
    <div class="sep" style="margin-left:auto"></div>
    <div class="ctrl">
      <button class="btn" id="dl-svg">SVG</button>
      <button class="btn" id="copy-svg">Copy SVG</button>
      <button class="btn primary" id="dl-png">Download PNG</button>
    </div>
  </div>

  <div class="toolbar" id="toolbar-ascii" style="display:none">
    <div class="sep" style="margin-left:auto"></div>
    <button class="btn primary" id="copy-ascii">Copy ASCII</button>
  </div>

  <main>
    <section class="pane editor">
      <div class="pane-head"><span>Mermaid source</span></div>
      <textarea id="code" spellcheck="false">${SAMPLE.replace(/</g, '&lt;')}</textarea>
    </section>
    <section class="pane">
      <div class="pane-head"><span>Preview</span><span id="status"></span></div>
      <div class="preview" id="preview"></div>
    </section>
  </main>

  <div class="toast" id="toast"></div>

  <!-- Bundled beautiful-mermaid renderer → window.__mermaid -->
  <script>
${bundleJs}
  </script>
  <script>
  (function () {
    var M = window.__mermaid;

    var RATIOS = {
      'fit':  null,
      '1:1':  [1080, 1080],
      '3:4':  [1080, 1440],
      '4:3':  [1440, 1080],
      '16:9': [1920, 1080],
      '9:16': [1080, 1920]
    };
    var MARGIN = 0.06; // diagram inset as a fraction of the frame's shorter side

    var el = function (id) { return document.getElementById(id); };
    var els = {
      code: el('code'), theme: el('theme'), font: el('font'), curved: el('curved'),
      mode: el('mode'), ratio: el('ratio'), transparent: el('transparent'), shadow: el('shadow'),
      bgUpload: el('bg-upload'), bgFile: el('bg-file'), bgName: el('bg-name'), bgClear: el('bg-clear'),
      preview: el('preview'), status: el('status'), toast: el('toast'),
      tbSvg: el('toolbar-svg'), tbAscii: el('toolbar-ascii')
    };

    var state = {
      mode: 'svg', ascii: '',
      svgTransparent: '', svgEl: null, frameEl: null,
      bgUrl: null, bgImg: null,
      // Diagram placement over the frame, normalized to frame size so it maps
      // 1:1 to any export resolution. cx/cy = center fraction, w = width fraction.
      geom: null, svgAspect: 0.66
    };
    var seq = 0;

    function colors() {
      var parts = els.theme.value.split('::');
      return M.brandColors(parts[0], parts[1]);
    }
    function brandFont() {
      var id = els.theme.value.split('::')[0];
      var b = (M.BRANDS || []).find(function (x) { return x.id === id; });
      return b ? b.font : null;
    }
    // True for "glass" themes (translucent surfaces meant to overlay an image).
    function isGlass() {
      var id = els.theme.value.split('::')[0];
      var b = (M.BRANDS || []).find(function (x) { return x.id === id; });
      return !!(b && b.glass);
    }

    // ── Frosted backdrop (glass themes) ──────────────────────────────────
    // Renders a *mask* SVG where only node fills are opaque white, used to clip
    // a blurred copy of the background image to the node shapes. Real per-node
    // backdrop blur in the live preview; export stays flat (see exportPNG).
    var MASK_PALETTE = {
      bg: 'transparent', fg: 'transparent', line: 'transparent',
      accent: 'transparent', muted: 'transparent',
      surface: '#fff', border: 'transparent'
    };
    function renderMask() {
      var opts = Object.assign({}, MASK_PALETTE, {
        font: els.font.value,
        edgeStyle: els.curved.checked ? 'curved' : 'sharp',
        transparent: true
      });
      return M.renderMermaidSVGAsync(els.code.value, opts).then(function (svg) {
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
    }
    function buildFrost(frame) {
      var old = frame.querySelector('.frame-frost'); if (old) old.remove();
      if (!isGlass() || !state.bgUrl || els.transparent.checked) return;
      var frost = document.createElement('div'); frost.className = 'frame-frost';
      frost.style.backgroundImage = 'url(' + state.bgUrl + ')';
      frame.insertBefore(frost, frame.firstChild);
      renderMask().then(function (url) {
        frost.style.webkitMaskImage = 'url("' + url + '")';
        frost.style.maskImage = 'url("' + url + '")';
        updateFrost();
      });
    }
    // Align the frost mask with the diagram's current on-screen box (works for
    // both contained "fit" and freely placed modes).
    function updateFrost() {
      var frame = state.frameEl; if (!frame) return;
      var frost = frame.querySelector('.frame-frost'); if (!frost || !state.svgEl) return;
      var fr = frame.getBoundingClientRect(), sr = state.svgEl.getBoundingClientRect();
      var x = (sr.left - fr.left) + 'px', y = (sr.top - fr.top) + 'px';
      var size = sr.width + 'px ' + sr.height + 'px';
      frost.style.webkitMaskPosition = x + ' ' + y; frost.style.maskPosition = x + ' ' + y;
      frost.style.webkitMaskSize = size; frost.style.maskSize = size;
    }
    function toast(msg) {
      els.toast.textContent = msg; els.toast.classList.add('show');
      clearTimeout(toast._t); toast._t = setTimeout(function () { els.toast.classList.remove('show'); }, 1400);
    }

    // ── Frame sizing (fit the chosen ratio inside the preview pane) ───────
    function sizeFrame() {
      var frame = state.frameEl; if (!frame) return;
      var pad = 28;
      var availW = els.preview.clientWidth - pad * 2;
      var availH = els.preview.clientHeight - pad * 2;
      var ar;
      var dims = RATIOS[els.ratio.value];
      if (dims) { ar = dims[0] / dims[1]; }
      else {
        var sw = state.svgEl ? (state.svgEl.width.baseVal.value || 4) : 4;
        var sh = state.svgEl ? (state.svgEl.height.baseVal.value || 3) : 3;
        ar = sw / sh;
      }
      var fw = availW, fh = availW / ar;
      if (fh > availH) { fh = availH; fw = availH * ar; }
      fw = Math.max(40, fw); fh = Math.max(40, fh);
      frame.style.width = fw + 'px';
      frame.style.height = fh + 'px';
      updateFrost();
    }

    // Free placement is enabled for fixed ratios (room around the diagram).
    // "Fit diagram" auto-centers and contains (no manipulation needed).
    function interactive() { return els.ratio.value !== 'fit'; }

    // A centered, contained default placement for the current frame.
    function defaultGeom(fw, fh) {
      var a = state.svgAspect, avail = 1 - 2 * MARGIN;
      var boxW = fw * avail;
      if (boxW * a > fh * avail) boxW = (fh * avail) / a;
      return { cxN: 0.5, cyN: 0.5, wN: boxW / fw };
    }

    function applyGeom(hold, frame) {
      var fw = frame.clientWidth, fh = frame.clientHeight;
      var w = state.geom.wN * fw, h = w * state.svgAspect;
      hold.style.width = w + 'px'; hold.style.height = h + 'px';
      hold.style.left = (state.geom.cxN * fw - w / 2) + 'px';
      hold.style.top = (state.geom.cyN * fh - h / 2) + 'px';
      updateFrost();
    }

    // Position the diagram inside the frame: contained (fit) or free (ratios).
    function positionDiagram() {
      var frame = state.frameEl; if (!frame) return;
      var hold = frame.querySelector('.frame-diagram'); if (!hold) return;
      var fw = frame.clientWidth, fh = frame.clientHeight;
      if (!interactive()) {
        hold.classList.add('fit'); hold.tabIndex = -1;
        hold.style.left = hold.style.top = hold.style.width = hold.style.height = '';
        removeHandles(hold);
        updateFrost();
        return;
      }
      hold.classList.remove('fit'); hold.style.inset = ''; hold.tabIndex = 0;
      if (!state.geom) state.geom = defaultGeom(fw, fh);
      applyGeom(hold, frame);
      if (!hold.querySelector('.handle')) addHandles(hold);
    }

    function removeHandles(hold) {
      [].slice.call(hold.querySelectorAll('.handle')).forEach(function (h) { h.remove(); });
    }
    function addHandles(hold) {
      ['nw', 'ne', 'sw', 'se'].forEach(function (pos) {
        var hd = document.createElement('div'); hd.className = 'handle ' + pos;
        hd.addEventListener('pointerdown', function (e) { startResize(e, pos, hold); });
        hold.appendChild(hd);
      });
    }

    // ── Snapping (center + edges of the frame), Figma-style guides ────────
    function hideGuides() {
      if (!state.frameEl) return;
      var v = state.frameEl.querySelector('.guide.v'), h = state.frameEl.querySelector('.guide.h');
      if (v) v.style.display = 'none'; if (h) h.style.display = 'none';
    }
    function applySnap(cx, cy, w, h, fw, fh) {
      var T = 7;
      var gv = state.frameEl.querySelector('.guide.v'), gh = state.frameEl.querySelector('.guide.h');
      gv.style.display = 'none'; gh.style.display = 'none';
      var lineX = null;
      if (Math.abs(cx - fw / 2) < T) { cx = fw / 2; lineX = fw / 2; }
      else if (Math.abs(cx - w / 2) < T) { cx = w / 2; lineX = 0; }
      else if (Math.abs(cx + w / 2 - fw) < T) { cx = fw - w / 2; lineX = fw; }
      if (lineX !== null) { gv.style.left = lineX + 'px'; gv.style.display = 'block'; }
      var lineY = null;
      if (Math.abs(cy - fh / 2) < T) { cy = fh / 2; lineY = fh / 2; }
      else if (Math.abs(cy - h / 2) < T) { cy = h / 2; lineY = 0; }
      else if (Math.abs(cy + h / 2 - fh) < T) { cy = fh - h / 2; lineY = fh; }
      if (lineY !== null) { gh.style.top = lineY + 'px'; gh.style.display = 'block'; }
      return { cx: cx, cy: cy };
    }

    // ── Drag (move) ──────────────────────────────────────────────────────
    function startDrag(e, hold) {
      if (!interactive()) return;
      if (e.target && e.target.classList.contains('handle')) return;
      e.preventDefault(); hold.focus();
      var frame = state.frameEl, fw = frame.clientWidth, fh = frame.clientHeight;
      var w = hold.offsetWidth, h = hold.offsetHeight;
      var startCx = state.geom.cxN * fw, startCy = state.geom.cyN * fh;
      var sx = e.clientX, sy = e.clientY;
      function move(ev) {
        var snapped = applySnap(startCx + (ev.clientX - sx), startCy + (ev.clientY - sy), w, h, fw, fh);
        state.geom.cxN = snapped.cx / fw; state.geom.cyN = snapped.cy / fh;
        applyGeom(hold, frame);
      }
      function up() { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); hideGuides(); }
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
    }

    // ── Resize (proportional, opposite corner anchored) ──────────────────
    function startResize(e, pos, hold) {
      e.preventDefault(); e.stopPropagation(); hold.focus();
      var frame = state.frameEl, fw = frame.clientWidth, fh = frame.clientHeight;
      var rect = { left: hold.offsetLeft, top: hold.offsetTop, w: hold.offsetWidth, h: hold.offsetHeight };
      var west = pos.charAt(1) === 'w', north = pos.charAt(0) === 'n';
      var anchorX = west ? rect.left + rect.w : rect.left;
      var anchorY = north ? rect.top + rect.h : rect.top;
      var a = state.svgAspect, MINW = 40;
      function move(ev) {
        var frect = frame.getBoundingClientRect();
        var localX = ev.clientX - frect.left;
        var w = Math.abs(localX - anchorX); if (w < MINW) w = MINW;
        var h = w * a;
        var left = west ? anchorX - w : anchorX;
        var top = north ? anchorY - h : anchorY;
        state.geom.wN = w / fw;
        state.geom.cxN = (left + w / 2) / fw;
        state.geom.cyN = (top + h / 2) / fh;
        applyGeom(hold, frame);
      }
      function up() { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); }
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
    }

    function paintFrameBg(frame) {
      frame.classList.remove('checker');
      frame.style.backgroundImage = '';
      frame.style.background = '';
      if (els.transparent.checked) { frame.classList.add('checker'); }
      else if (state.bgUrl) { frame.style.backgroundImage = 'url(' + state.bgUrl + ')'; frame.style.backgroundSize = 'cover'; frame.style.backgroundPosition = 'center'; }
      // Glass themes have a transparent bg by design — with no image loaded, show
      // the checkerboard so it's clear the diagram is meant to overlay a photo.
      else if (isGlass()) { frame.classList.add('checker'); }
      else { var c = colors(); frame.style.background = c ? c.bg : '#fff'; }
      updateChrome(frame);
    }

    // Hide the card border/shadow for the plain case (Fit ratio, no image, not
    // transparent) so it looks seamless — like a diagram on the theme bg.
    function updateChrome(frame) {
      frame = frame || state.frameEl; if (!frame) return;
      var plain = els.ratio.value === 'fit' && !els.transparent.checked && !state.bgUrl;
      frame.classList.toggle('plain', plain);
    }

    // ── Render ────────────────────────────────────────────────────────────
    function render() {
      var c = colors(); if (!c) return;
      els.preview.style.background = c.bg; // seamless: pane matches the theme bg

      if (state.mode === 'ascii') {
        try {
          var ascii = M.renderMermaidASCII(els.code.value, { theme: M.diagramColorsToAsciiTheme(c), colorMode: 'none' });
          state.ascii = ascii;
          var pre = document.createElement('pre'); pre.className = 'ascii'; pre.textContent = ascii; pre.style.color = c.fg;
          els.preview.innerHTML = ''; els.preview.appendChild(pre);
          els.status.textContent = '';
        } catch (e) { els.preview.innerHTML = '<div class="err">ASCII: ' + String(e) + '</div>'; }
        return;
      }

      var my = ++seq;
      var opts = Object.assign({}, c, { font: els.font.value, edgeStyle: els.curved.checked ? 'curved' : 'sharp', transparent: true });
      els.status.textContent = 'rendering…';
      M.renderMermaidSVGAsync(els.code.value, opts).then(function (svg) {
        if (my !== seq) return;
        state.svgTransparent = svg;
        var frame = document.createElement('div'); frame.className = 'frame';
        var hold = document.createElement('div'); hold.className = 'frame-diagram' + (els.shadow.checked ? ' shadow' : '');
        hold.innerHTML = svg;
        frame.appendChild(hold);
        var gv = document.createElement('div'); gv.className = 'guide v';
        var gh = document.createElement('div'); gh.className = 'guide h';
        frame.appendChild(gv); frame.appendChild(gh);
        els.preview.innerHTML = ''; els.preview.appendChild(frame);
        state.frameEl = frame; state.svgEl = hold.querySelector('svg');
        state.svgAspect = state.svgEl ? (state.svgEl.height.baseVal.value / state.svgEl.width.baseVal.value) : 0.66;
        hold.addEventListener('pointerdown', function (e) { startDrag(e, hold); });
        hold.addEventListener('dblclick', function () { if (interactive()) { state.geom = defaultGeom(frame.clientWidth, frame.clientHeight); applyGeom(hold, frame); } });
        paintFrameBg(frame); sizeFrame(); positionDiagram(); buildFrost(frame);
        els.status.textContent = '';
      }).catch(function (e) {
        if (my !== seq) return;
        els.preview.innerHTML = '<div class="err">' + String(e) + '</div>'; els.status.textContent = 'error';
      });
    }

    // ── Export helpers ──────────────────────────────────────────────────
    function download(filename, blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
    function loadImage(src) {
      return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
    }
    function drawCover(ctx, img, cw, ch) {
      var ir = img.width / img.height, cr = cw / ch, dw, dh;
      if (ir > cr) { dh = ch; dw = ch * ir; } else { dw = cw; dh = cw / ir; }
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    }

    function exportPNG() {
      var c = colors(); if (!c || !state.svgTransparent) return;
      var dims = RATIOS[els.ratio.value];
      var sw = state.svgEl ? (state.svgEl.width.baseVal.value || 1200) : 1200;
      var sh = state.svgEl ? (state.svgEl.height.baseVal.value || 800) : 800;
      var cw, ch;
      if (dims) { cw = dims[0]; ch = dims[1]; }
      else { var scale = Math.max(1, Math.ceil(1080 / Math.min(sw, sh))); cw = Math.round(sw * scale); ch = Math.round(sh * scale); }

      var canvas = document.createElement('canvas'); canvas.width = cw; canvas.height = ch;
      var ctx = canvas.getContext('2d');

      var bgStep = Promise.resolve();
      if (els.transparent.checked) { /* leave alpha */ }
      else if (state.bgImg) { drawCover(ctx, state.bgImg, cw, ch); }
      else { ctx.fillStyle = c.bg; ctx.fillRect(0, 0, cw, ch); }

      bgStep.then(function () {
        return loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(state.svgTransparent));
      }).then(function (img) {
        var dw, dh, dx, dy;
        if (dims && state.geom) {
          // Honor the user's drag/resize placement (normalized → canvas px).
          dw = state.geom.wN * cw; dh = dw * state.svgAspect;
          dx = state.geom.cxN * cw - dw / 2; dy = state.geom.cyN * ch - dh / 2;
        } else {
          // Fit: contain centered with margin.
          var m = Math.min(cw, ch) * MARGIN;
          var availW = cw - m * 2, availH = ch - m * 2;
          var sr = sw / sh;
          if (sr > availW / availH) { dw = availW; dh = availW / sr; } else { dh = availH; dw = availH * sr; }
          dx = (cw - dw) / 2; dy = (ch - dh) / 2;
        }
        if (els.shadow.checked) {
          var s = Math.min(cw, ch);
          ctx.shadowColor = 'rgba(9,23,23,0.26)';
          ctx.shadowBlur = Math.round(s * 0.012);
          ctx.shadowOffsetY = Math.round(s * 0.006);
        }
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        canvas.toBlob(function (b) {
          var tag = els.ratio.value.replace(':', 'x') + (els.transparent.checked ? '-transparent' : '');
          download('bm-' + tag + '.png', b); toast('Downloaded ' + cw + '×' + ch);
        }, 'image/png');
      }).catch(function () { toast('PNG export failed'); });
    }

    function downloadSVG() {
      // Re-render an opaque, themed SVG (clean vector — no frame / bg image).
      var c = colors(); if (!c) return;
      var opts = Object.assign({}, c, { font: els.font.value, edgeStyle: els.curved.checked ? 'curved' : 'sharp' });
      M.renderMermaidSVGAsync(els.code.value, opts).then(function (svg) {
        download('bm-diagram.svg', new Blob([svg], { type: 'image/svg+xml' })); toast('Downloaded SVG');
      });
    }
    function copySVG() {
      navigator.clipboard.writeText(state.svgTransparent).then(function () { toast('Copied SVG'); }, function () { toast('Copy failed'); });
    }
    function copyASCII() {
      navigator.clipboard.writeText(state.ascii).then(function () { toast('Copied ASCII'); }, function () { toast('Copy failed'); });
    }

    // ── Background image upload ──────────────────────────────────────────
    els.bgUpload.addEventListener('click', function () { els.bgFile.click(); });
    els.bgFile.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        state.bgUrl = reader.result;
        loadImage(state.bgUrl).then(function (img) { state.bgImg = img; if (state.frameEl) { paintFrameBg(state.frameEl); buildFrost(state.frameEl); } });
        els.bgName.textContent = f.name; els.bgClear.style.display = '';
      };
      reader.readAsDataURL(f);
    });
    els.bgClear.addEventListener('click', function () {
      state.bgUrl = null; state.bgImg = null; els.bgName.textContent = ''; els.bgClear.style.display = 'none';
      els.bgFile.value = ''; if (state.frameEl) { paintFrameBg(state.frameEl); buildFrost(state.frameEl); }
    });

    // ── Wire up controls ────────────────────────────────────────────────
    var debounce;
    els.code.addEventListener('input', function () { clearTimeout(debounce); debounce = setTimeout(render, 180); });
    els.theme.addEventListener('change', function () { var f = brandFont(); if (f) els.font.value = f; render(); });
    els.font.addEventListener('change', render);
    els.curved.addEventListener('change', render);
    els.ratio.addEventListener('change', function () { state.geom = null; if (state.frameEl) { sizeFrame(); updateChrome(); positionDiagram(); } });
    els.transparent.addEventListener('change', function () { if (state.frameEl) { paintFrameBg(state.frameEl); buildFrost(state.frameEl); } });
    els.shadow.addEventListener('change', function () { var h = state.frameEl && state.frameEl.querySelector('.frame-diagram'); if (h) h.classList.toggle('shadow', els.shadow.checked); });
    window.addEventListener('resize', function () { if (state.mode === 'svg' && state.frameEl) { sizeFrame(); positionDiagram(); } });

    // Arrow-key nudge — only when the diagram object is selected (focused),
    // so typing in the code editor / using selects is never hijacked.
    // 1px per press, 10px with Shift.
    document.addEventListener('keydown', function (e) {
      if (state.mode !== 'svg' || !interactive() || !state.frameEl || !state.geom) return;
      var hold = state.frameEl.querySelector('.frame-diagram');
      if (!hold || document.activeElement !== hold) return;
      var step = e.shiftKey ? 10 : 1, dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else return;
      e.preventDefault();
      state.geom.cxN += dx / state.frameEl.clientWidth;
      state.geom.cyN += dy / state.frameEl.clientHeight;
      applyGeom(hold, state.frameEl);
    });

    els.mode.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.mode = b.getAttribute('data-mode');
      [].forEach.call(els.mode.children, function (x) { x.classList.toggle('active', x === b); });
      els.tbSvg.style.display = state.mode === 'svg' ? '' : 'none';
      els.tbAscii.style.display = state.mode === 'ascii' ? '' : 'none';
      render();
    });

    el('dl-png').addEventListener('click', exportPNG);
    el('dl-svg').addEventListener('click', downloadSVG);
    el('copy-svg').addEventListener('click', copySVG);
    el('copy-ascii').addEventListener('click', copyASCII);

    els.code.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') { e.preventDefault(); var s = this.selectionStart, en = this.selectionEnd; this.value = this.value.slice(0, s) + '  ' + this.value.slice(en); this.selectionStart = this.selectionEnd = s + 2; }
    });

    // Init
    els.font.value = '${defaultFont}';
    render();
  })();
  </script>
</body>
</html>`

await Bun.write('bm-editor.html', html)
console.log('\x1b[32m✓\x1b[0m Wrote bm-editor.html')

if (process.argv.includes('--serve')) {
  // Try the preferred port; if it's busy, fall back to the next free one.
  let port = 4568
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      Bun.serve({
        port,
        fetch() {
          return new Response(html, { headers: { 'Content-Type': 'text/html' } })
        },
      })
      console.log(`\x1b[36m▶\x1b[0m Editor at \x1b[1mhttp://localhost:${port}\x1b[0m`)
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
