// ============================================================================
// Themed official-mermaid engine.
//
// The core diagram engine: drives the official `mermaid` library, themed from
// our brand DiagramColors, so we can pull upstream diagram support for free
// while keeping the on-brand look. Replaces the from-scratch custom renderer for
// every diagram type mermaid supports.
//
// DOM-dependent (mermaid measures text in the DOM) and async — reachable only
// through renderMermaidSVGAsync in a browser context (the composer editor).
//
// Pipeline: DiagramColors → themeVariables  +  BASE_FINISH_CSS (+ per-theme css)
//           → mermaid.render → postProcess (explicit size, bg rect, embedded
//           font @import so the SVG is self-contained for PNG/SVG export).
// ============================================================================

import mermaid from 'mermaid'
import type { DiagramColors } from '../theme.ts'
import type { ConnectorStyle } from '../types.ts'
import { BASE_FINISH_CSS } from './finish.ts'

let renderCounter = 0
let lastInitKey = ''

export interface ThemedMermaidOptions {
  font?: string
  transparent?: boolean
  edgeStyle?: ConnectorStyle
  /** Per-theme themeCSS override, appended to BASE_FINISH_CSS. */
  themeCss?: string
}

/** Map our brand DiagramColors onto mermaid's `base` theme variables. */
function buildThemeVariables(colors: DiagramColors, font: string, transparent: boolean) {
  const fontFamily = `'${font}', system-ui, sans-serif`
  const line = colors.line ?? colors.fg
  const border = colors.border ?? colors.line ?? colors.fg
  const surface = colors.surface ?? colors.bg
  return {
    background: transparent ? 'transparent' : colors.bg,
    primaryColor: surface,
    primaryBorderColor: border,
    primaryTextColor: colors.fg,
    secondaryColor: surface,
    secondaryBorderColor: border,
    secondaryTextColor: colors.fg,
    tertiaryColor: colors.bg,
    tertiaryBorderColor: border,
    tertiaryTextColor: colors.fg,
    lineColor: line,
    textColor: colors.fg,
    mainBkg: surface,
    nodeBorder: border,
    nodeTextColor: colors.fg,
    // Edge labels: chip background tinted from surface, secondary text color.
    edgeLabelBackground: surface,
    labelTextColor: colors.muted ?? colors.fg,
    // Clusters / subgraphs.
    clusterBkg: colors.bg,
    clusterBorder: border,
    // Arrowheads / highlights.
    primaryColor2: colors.accent ?? line,
    fontFamily,
    fontSize: '14px',
    // Notes (sequence/other) — keep the soft-yellow look.
    noteBkgColor: '#fff5ad',
    noteTextColor: '#333333',
    noteBorderColor: '#aaaa33',
  }
}

/**
 * Render mermaid source via the official library, themed from the given brand
 * colors + finish CSS. Returns a self-contained SVG string.
 */
export async function renderThemedMermaid(
  text: string,
  colors: DiagramColors,
  opts: ThemedMermaidOptions = {},
): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error(
      'The mermaid engine requires a browser DOM. Use renderMermaidSVGAsync in a ' +
        'browser (the composer editor), not the synchronous API.',
    )
  }

  const font = opts.font ?? 'Inter'
  const transparent = opts.transparent ?? false
  // 'curved' → smooth basis spline; 'sharp' → straight segments.
  const curve = opts.edgeStyle === 'curved' ? 'basis' : 'linear'

  const themeVariables = buildThemeVariables(colors, font, transparent)
  const themeCSS = BASE_FINISH_CSS + (opts.themeCss ?? '')

  // initialize() is global; only re-run when an input actually changes.
  const initKey = JSON.stringify({ themeVariables, themeCSS, curve })
  if (initKey !== lastInitKey) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      themeVariables,
      themeCSS,
      fontFamily: themeVariables.fontFamily,
      // Root-level htmlLabels:false keeps labels as SVG <text> (no
      // <foreignObject>), required for the SVG to rasterize reliably into a
      // <canvas> for PNG export. The per-diagram flowchart.htmlLabels is
      // deprecated and overridden by this root setting.
      htmlLabels: false,
      flowchart: { curve },
    })
    lastInitKey = initKey
  }

  const id = `bm-mermaid-${++renderCounter}`
  const { svg } = await mermaid.render(id, text)
  return postProcess(svg, colors, transparent, font)
}

/** Google-Fonts @import block so the exported SVG carries its own fonts. */
function fontImportStyle(font: string): string {
  const fam = encodeURIComponent(font)
  return (
    '<style>' +
    `@import url('https://fonts.googleapis.com/css2?family=${fam}:wght@400;500;600;700&amp;display=swap');` +
    `@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&amp;display=swap');` +
    '</style>'
  )
}

/**
 * Normalize mermaid's SVG for our display/export pipeline:
 *  - explicit width/height from the viewBox (mermaid emits max-width),
 *  - opaque background rect when not transparent,
 *  - embedded font @import so the SVG renders standalone.
 */
function postProcess(svg: string, colors: DiagramColors, transparent: boolean, font: string): string {
  const vb = svg.match(/viewBox="([\d.\- ]+)"/)
  let minX = 0
  let minY = 0
  let width = 0
  let height = 0
  if (vb) {
    const parts = vb[1]!.trim().split(/\s+/).map(Number)
    minX = parts[0] ?? 0
    minY = parts[1] ?? 0
    width = parts[2] ?? 0
    height = parts[3] ?? 0
  }

  if (!width || !height) return svg

  // Rewrite only the opening <svg ...> tag — inner elements also carry
  // width/height attributes, so a document-wide replace would corrupt them.
  const tagEnd = svg.indexOf('>')
  let openTag = svg.slice(0, tagEnd)
  const rest = svg.slice(tagEnd) // starts with '>'

  openTag = /\swidth="[^"]*"/.test(openTag)
    ? openTag.replace(/\swidth="[^"]*"/, ` width="${width}"`)
    : `${openTag} width="${width}"`
  openTag = /\sheight="[^"]*"/.test(openTag)
    ? openTag.replace(/\sheight="[^"]*"/, ` height="${height}"`)
    : `${openTag} height="${height}"`
  openTag = openTag.replace(/\sstyle="[^"]*"/, '')

  const fonts = fontImportStyle(font)
  const bg = transparent
    ? ''
    : `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${colors.bg}" />`

  return `${openTag}${rest.slice(0, 1)}${fonts}${bg}${rest.slice(1)}`
}
