import mermaid from 'mermaid'
import type { DiagramColors } from '../theme.ts'

// ============================================================================
// Mermaid fallback renderer
//
// For diagram types the native engine doesn't implement (kanban, pie, gantt,
// mindmap, timeline, gitGraph, quadrant, …) we fall back to the official
// mermaid library, themed from the same brand DiagramColors so the output
// stays on-brand.
//
// This path is async and DOM-dependent (mermaid measures text in the DOM), so
// it is only reachable through renderMermaidSVGAsync in a browser context — it
// is intentionally NOT wired into the synchronous, no-DOM renderMermaidSVG.
// ============================================================================

let renderCounter = 0
let lastThemeKey = ''

/** Map our brand DiagramColors onto mermaid's `base` theme variables. */
function buildThemeVariables(colors: DiagramColors, font: string, transparent: boolean) {
  const fontFamily = `'${font}', system-ui, sans-serif`
  return {
    background: transparent ? 'transparent' : colors.bg,
    primaryColor: colors.surface ?? colors.bg,
    primaryBorderColor: colors.border ?? colors.line ?? colors.fg,
    primaryTextColor: colors.fg,
    secondaryColor: colors.surface ?? colors.bg,
    secondaryBorderColor: colors.border ?? colors.line ?? colors.fg,
    secondaryTextColor: colors.fg,
    tertiaryColor: colors.bg,
    tertiaryBorderColor: colors.border ?? colors.line ?? colors.fg,
    tertiaryTextColor: colors.fg,
    lineColor: colors.line ?? colors.fg,
    textColor: colors.fg,
    mainBkg: colors.surface ?? colors.bg,
    nodeBorder: colors.border ?? colors.line ?? colors.fg,
    fontFamily,
    fontSize: '14px',
    // Notes (used by several diagram types) — keep the soft-yellow look.
    noteBkgColor: '#fff5ad',
    noteTextColor: '#333333',
    noteBorderColor: '#aaaa33',
  }
}

/**
 * Render arbitrary mermaid source via the official library, themed from the
 * given brand colors. Returns a self-contained SVG string.
 *
 * @param text - Raw mermaid source (front-matter is handled by mermaid itself).
 */
export async function renderWithMermaid(
  text: string,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error(
      'This diagram type is rendered via the mermaid fallback, which requires a browser DOM. ' +
        'Use renderMermaidSVGAsync in a browser (the composer editor), not the synchronous API.',
    )
  }

  const themeVariables = buildThemeVariables(colors, font, transparent)

  // Re-initialize only when the theme inputs change (initialize is global).
  const themeKey = JSON.stringify(themeVariables)
  if (themeKey !== lastThemeKey) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      themeVariables,
      fontFamily: themeVariables.fontFamily,
    })
    lastThemeKey = themeKey
  }

  const id = `bm-mermaid-${++renderCounter}`
  const { svg } = await mermaid.render(id, text)
  return postProcess(svg, colors, transparent)
}

/**
 * Normalize mermaid's SVG for our display/export pipeline:
 *  - give it explicit width/height from the viewBox (mermaid emits max-width),
 *  - add an opaque background rect when not transparent.
 */
function postProcess(svg: string, colors: DiagramColors, transparent: boolean): string {
  const vb = svg.match(/viewBox="([\d.\- ]+)"/)
  let width = 0
  let height = 0
  if (vb) {
    const parts = vb[1]!.trim().split(/\s+/).map(Number)
    width = parts[2] ?? 0
    height = parts[3] ?? 0
  }

  if (!width || !height) return svg

  // Only rewrite the opening <svg ...> tag — inner elements (rects, etc.) also
  // carry width/height attributes, so a document-wide replace would corrupt them.
  const tagEnd = svg.indexOf('>')
  let openTag = svg.slice(0, tagEnd)
  const rest = svg.slice(tagEnd) // starts with '>'

  // Replace mermaid's responsive "max-width" sizing with explicit width/height
  // so the diagram displays and exports at a predictable resolution.
  openTag = /\swidth="[^"]*"/.test(openTag)
    ? openTag.replace(/\swidth="[^"]*"/, ` width="${width}"`)
    : `${openTag} width="${width}"`
  openTag = /\sheight="[^"]*"/.test(openTag)
    ? openTag.replace(/\sheight="[^"]*"/, ` height="${height}"`)
    : `${openTag} height="${height}"`
  openTag = openTag.replace(/\sstyle="[^"]*"/, '')

  // Add an opaque background rect (spanning the viewBox) for non-transparent
  // exports. viewBox may use a non-zero origin, so honor minX/minY.
  let bg = ''
  if (!transparent) {
    const parts = (svg.match(/viewBox="([\d.\- ]+)"/)?.[1] ?? '').trim().split(/\s+/).map(Number)
    const minX = parts[0] ?? 0
    const minY = parts[1] ?? 0
    bg = `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${colors.bg}" />`
  }

  return `${openTag}${rest.slice(0, 1)}${bg}${rest.slice(1)}`
}
