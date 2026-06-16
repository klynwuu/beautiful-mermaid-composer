// ============================================================================
// beautiful-mermaid — public API
//
// Renders Mermaid diagrams to styled SVG strings.
// Framework-agnostic, no DOM required. Pure TypeScript.
//
// Supported diagram types:
//   - Flowcharts (graph TD / flowchart LR)
//   - State diagrams (stateDiagram-v2)
//   - Sequence diagrams (sequenceDiagram)
//   - Class diagrams (classDiagram)
//   - ER diagrams (erDiagram)
//
// Theming uses CSS custom properties (--bg, --fg, + optional enrichment).
// See src/theme.ts for the full variable system.
//
// Usage:
//   import { renderMermaidSVG } from 'beautiful-mermaid'
//   const svg = renderMermaidSVG('graph TD\n  A --> B')
// ============================================================================

export type { RenderOptions, MermaidGraph, PositionedGraph } from './types.ts'
export type { DiagramColors, ThemeName } from './theme.ts'
export { fromShikiTheme, THEMES, DEFAULTS } from './theme.ts'
export { parseMermaid } from './parser.ts'
export { renderMermaidASCII, renderMermaidAscii } from './ascii/index.ts'
export type { AsciiRenderOptions } from './ascii/index.ts'

import { decodeXML } from 'entities'
import { escapeXml } from './multiline-utils.ts'
import { parseMermaid } from './parser.ts'
import { layoutGraphSync } from './layout.ts'
import { renderSvg } from './renderer.ts'
import type { RenderOptions } from './types.ts'
import type { DiagramColors } from './theme.ts'
import { DEFAULTS } from './theme.ts'

import { parseSequenceDiagram } from './sequence/parser.ts'
import { layoutSequenceDiagram } from './sequence/layout.ts'
import { renderSequenceSvg } from './sequence/renderer.ts'
import { parseClassDiagram } from './class/parser.ts'
import { layoutClassDiagramSync } from './class/layout.ts'
import { renderClassSvg } from './class/renderer.ts'
import { parseErDiagram } from './er/parser.ts'
import { layoutErDiagramSync } from './er/layout.ts'
import { renderErSvg } from './er/renderer.ts'
import { parseXYChart } from './xychart/parser.ts'
import { layoutXYChart } from './xychart/layout.ts'
import { renderXYChartSvg } from './xychart/renderer.ts'
import { renderTimelineSvg } from './timeline/index.ts'
import { renderQuadrantSvg } from './quadrant/index.ts'
import { renderVennSvg } from './venn/index.ts'
import { renderIshikawaSvg } from './ishikawa/index.ts'
import { renderGitGraphSvg } from './gitgraph/index.ts'
import { renderEventModelingSvg } from './eventmodeling/index.ts'

/**
 * Detect the diagram type from the mermaid source text.
 * Returns the type keyword used for routing to the correct pipeline.
 */
type NativeDiagramType = 'flowchart' | 'sequence' | 'class' | 'er' | 'xychart' | 'timeline' | 'quadrant' | 'venn' | 'ishikawa' | 'gitgraph' | 'eventmodeling'

/**
 * Detect the diagram type. Returns one of the natively-rendered types, or
 * 'fallback' for any other recognized mermaid diagram (kanban, pie, gantt,
 * mindmap, timeline, gitGraph, …) which is rendered via the mermaid library.
 */
function detectDiagramType(text: string): NativeDiagramType | 'fallback' {
  const firstLine = text.trim().split(/[\n;]/)[0]?.trim().toLowerCase() ?? ''

  if (/^xychart(-beta)?\b/.test(firstLine)) return 'xychart'
  if (/^sequencediagram\b/.test(firstLine)) return 'sequence'
  if (/^classdiagram\b/.test(firstLine)) return 'class'
  if (/^erdiagram\b/.test(firstLine)) return 'er'
  if (/^timeline\b/.test(firstLine)) return 'timeline'
  if (/^quadrantchart\b/.test(firstLine)) return 'quadrant'
  if (/^venn(-beta)?\b/.test(firstLine)) return 'venn'
  if (/^ishikawa\b/.test(firstLine)) return 'ishikawa'
  if (/^gitgraph\b/.test(firstLine)) return 'gitgraph'
  if (/^eventmodeling\b/.test(firstLine)) return 'eventmodeling'

  // Flowchart and state diagrams are handled natively by parseMermaid.
  if (/^(graph|flowchart)\b/.test(firstLine)) return 'flowchart'
  if (/^statediagram(-v2)?\b/.test(firstLine)) return 'flowchart'

  // Anything else (kanban, pie, gantt, mindmap, …) goes to the mermaid fallback.
  return 'fallback'
}

/**
 * Strip a leading YAML front-matter block (Mermaid's `--- ... ---` header) and
 * pull out the `title:` if present. Returns the remaining diagram body.
 *
 * Mermaid uses the front-matter block for diagram title and config; we honor
 * the title and ignore the rest rather than failing to parse.
 */
function extractFrontmatter(text: string): { title?: string; body: string } {
  const fm = text.match(/^﻿?[ \t]*\r?\n*---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
  if (!fm) return { body: text }

  const yaml = fm[1] ?? ''
  const body = text.slice(fm[0].length)

  const titleMatch = yaml.match(/^[ \t]*title:[ \t]*(.+?)[ \t]*$/m)
  let title = titleMatch?.[1]?.trim()
  if (title) title = title.replace(/^["']|["']$/g, '').trim()

  return { title: title || undefined, body }
}

/** Title band height and font size for the front-matter title. */
const TITLE_BAND = 40
const TITLE_FONT_SIZE = 16

/**
 * Wrap a finished diagram SVG with a centered title above it. The original
 * content is shifted down by a fixed band; the SVG height/viewBox grow to fit.
 * The title inherits the theme text color via the existing CSS variables.
 */
function injectTitle(svg: string, title: string): string {
  const dim = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
  if (!dim) return svg

  const w = parseFloat(dim[1]!)
  const h = parseFloat(dim[2]!)
  const newH = h + TITLE_BAND

  const openEnd = svg.indexOf('>') + 1
  const head = svg
    .slice(0, openEnd)
    .replace(/viewBox="0 0 [\d.]+ [\d.]+"/, `viewBox="0 0 ${w} ${newH}"`)
    .replace(/width="[\d.]+" height="[\d.]+"/, `width="${w}" height="${newH}"`)

  const closeIdx = svg.lastIndexOf('</svg>')
  const inner = svg.slice(openEnd, closeIdx)

  const titleEl =
    `<text x="${w / 2}" y="${TITLE_BAND * 0.62}" text-anchor="middle" ` +
    `font-size="${TITLE_FONT_SIZE}" font-weight="600" fill="var(--_text)">${escapeXml(title)}</text>`

  return `${head}\n${titleEl}\n<g transform="translate(0,${TITLE_BAND})">${inner}</g>\n</svg>`
}

/**
 * Build a DiagramColors object from render options.
 * Uses DEFAULTS for bg/fg when not provided, and passes through
 * optional enrichment colors (line, accent, muted, surface, border).
 */
function buildColors(options: RenderOptions): DiagramColors {
  return {
    bg: options.bg ?? DEFAULTS.bg,
    fg: options.fg ?? DEFAULTS.fg,
    line: options.line,
    accent: options.accent,
    muted: options.muted,
    surface: options.surface,
    border: options.border,
  }
}

/**
 * Render Mermaid diagram text to an SVG string — synchronously.
 *
 * Uses elk.bundled.js with a direct FakeWorker bypass (no setTimeout(0) delay).
 * The ELK singleton is created lazily on first use and cached forever.
 *
 * Use this in React components with useMemo() to avoid flash:
 *   const svg = useMemo(() => renderMermaidSVG(code, opts), [code])
 *
 * @param text - Mermaid source text
 * @param options - Rendering options (colors, font, spacing)
 * @returns A self-contained SVG string
 *
 * @example
 * ```ts
 * const svg = renderMermaidSVG('graph TD\n  A --> B')
 *
 * // With theme
 * const svg = renderMermaidSVG('graph TD\n  A --> B', {
 *   bg: '#1a1b26', fg: '#a9b1d6'
 * })
 *
 * // With CSS variables (for live theme switching)
 * const svg = renderMermaidSVG('graph TD\n  A --> B', {
 *   bg: 'var(--background)', fg: 'var(--foreground)', transparent: true
 * })
 * ```
 */
export function renderMermaidSVG(
  text: string,
  options: RenderOptions = {}
): string {
  // Decode XML entities that may leak from markdown parsers (e.g. rehype-raw).
  // Without this, escapeXml() double-encodes them: &lt; → &amp;lt; → literal "&lt;" in SVG.
  text = decodeXML(text)

  // Strip the optional YAML front-matter header (title/config) before parsing.
  const { title, body } = extractFrontmatter(text)
  text = body

  const colors = buildColors(options)
  const font = options.font ?? 'Inter'
  const transparent = options.transparent ?? false
  const diagramType = detectDiagramType(text)

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))

  const withTitle = (svg: string): string => (title ? injectTitle(svg, title) : svg)

  if (diagramType === 'fallback') {
    throw new Error(
      'This diagram type is rendered via the mermaid fallback, which is asynchronous and ' +
        'requires a browser DOM. Use renderMermaidSVGAsync() instead of renderMermaidSVG().',
    )
  }

  switch (diagramType) {
    case 'sequence': {
      const diagram = parseSequenceDiagram(lines)
      const positioned = layoutSequenceDiagram(diagram, options)
      return withTitle(renderSequenceSvg(positioned, colors, font, transparent))
    }
    case 'class': {
      const diagram = parseClassDiagram(lines)
      const positioned = layoutClassDiagramSync(diagram, options)
      return withTitle(renderClassSvg(positioned, colors, font, transparent, options.edgeStyle ?? 'sharp'))
    }
    case 'er': {
      const diagram = parseErDiagram(lines)
      const positioned = layoutErDiagramSync(diagram, options)
      return withTitle(renderErSvg(positioned, colors, font, transparent))
    }
    case 'xychart': {
      const chart = parseXYChart(lines)
      const positioned = layoutXYChart(chart, options)
      return withTitle(renderXYChartSvg(positioned, colors, font, transparent, options.interactive ?? false))
    }
    case 'timeline': {
      return withTitle(renderTimelineSvg(lines, colors, font, transparent))
    }
    case 'quadrant': {
      return withTitle(renderQuadrantSvg(lines, colors, font, transparent))
    }
    case 'venn': {
      return withTitle(renderVennSvg(lines, colors, font, transparent))
    }
    case 'ishikawa': {
      // Ishikawa hierarchy is indentation-based, so pass untrimmed lines.
      const rawLines = text.split('\n').filter(l => l.trim().length > 0 && !l.trim().startsWith('%%'))
      return withTitle(renderIshikawaSvg(rawLines, colors, font, transparent))
    }
    case 'gitgraph': {
      return withTitle(renderGitGraphSvg(lines, colors, font, transparent))
    }
    case 'eventmodeling': {
      return withTitle(renderEventModelingSvg(lines, colors, font, transparent))
    }
    case 'flowchart':
    default: {
      const graph = parseMermaid(text)
      const positioned = layoutGraphSync(graph, options)
      return withTitle(renderSvg(positioned, colors, font, transparent, options.edgeStyle ?? 'sharp'))
    }
  }
}

/**
 * Render Mermaid diagram text to an SVG string — async.
 *
 * For the six natively-supported diagram types this returns the same result as
 * renderMermaidSVG(). For any other recognized mermaid diagram (kanban, pie,
 * gantt, mindmap, timeline, gitGraph, …) it lazily loads the mermaid library
 * and renders it themed from the same brand colors. That fallback requires a
 * browser DOM, so it only works in the browser (the composer editor).
 */
export async function renderMermaidSVGAsync(
  text: string,
  options: RenderOptions = {}
): Promise<string> {
  const decoded = decodeXML(text)
  const { body } = extractFrontmatter(decoded)

  if (detectDiagramType(body) === 'fallback') {
    // mermaid reads its own front-matter (e.g. kanban config), so pass the
    // original (decoded) source including the YAML header.
    const { renderWithMermaid } = await import('./fallback/mermaid-render.ts')
    return renderWithMermaid(
      decoded,
      buildColors(options),
      options.font ?? 'Inter',
      options.transparent ?? false,
    )
  }

  return renderMermaidSVG(text, options)
}

// ---------------------------------------------------------------------------
// Backward-compatible aliases
// ---------------------------------------------------------------------------

/** @deprecated Use `renderMermaidSVG` */
export const renderMermaidSync = renderMermaidSVG

/** @deprecated Use `renderMermaidSVGAsync` */
export const renderMermaid = renderMermaidSVGAsync
