import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS, estimateTextWidth } from '../styles.ts'
import { renderMultilineText, normalizeBrTags } from '../multiline-utils.ts'

// ============================================================================
// Ishikawa / fishbone diagram (native)
//
// Mermaid `ishikawa` syntax: the first content line is the effect (problem);
// indentation expresses cause hierarchy:
//   ishikawa
//     Late delivery
//       Machines
//         Old equipment
//       Methods
//         No QA process
//
// Rendered as a horizontal spine pointing into the effect box on the right,
// with category "bones" branching diagonally above/below the spine and their
// sub-causes listed at each bone tip. All strokes/fills are theme variables.
// ============================================================================

interface CauseNode {
  text: string
  children: CauseNode[]
}

const PAD = 24
const SLOT_GAP = 96
const BONE_LEN = 140
const COS = 0.5 // cos 60°
const SIN = 0.866 // sin 60°
const ACCENT = 'var(--accent, var(--_line))'

// Parse using leading-whitespace indentation. Expects RAW (untrimmed) lines
// with the `ishikawa` header already removed.
function parseWithIndent(raw: string[]): { effect: string; categories: CauseNode[] } {
  const items = raw
    .filter(l => l.trim().length > 0)
    .map(l => ({ indent: l.match(/^\s*/)![0].length, text: normalizeBrTags(l.trim()) }))

  if (items.length === 0) return { effect: '', categories: [] }
  const effect = items[0]!.text
  const rest = items.slice(1)
  if (rest.length === 0) return { effect, categories: [] }

  // The shallowest indent among the rest is the category level.
  const catIndent = Math.min(...rest.map(i => i.indent))
  const categories: CauseNode[] = []
  let current: CauseNode | null = null
  for (const it of rest) {
    if (it.indent <= catIndent) {
      current = { text: it.text, children: [] }
      categories.push(current)
    } else if (current) {
      current.children.push({ text: it.text, children: [] })
    }
  }
  return { effect, categories }
}

export function renderIshikawaSvg(
  rawLines: string[],
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  // Use raw (untrimmed) lines so indentation-based hierarchy survives.
  const { effect, categories } = parseWithIndent(rawLines.slice(1))

  const fontS = FONT_SIZES.edgeLabel
  const catFont = FONT_SIZES.nodeLabel

  // Effect box sizing.
  const effW = Math.max(120, estimateTextWidth(effect, catFont, 700) + 32)
  const effH = 54

  // Slot layout along the spine — categories alternate top/bottom.
  const nSlots = categories.length
  const spineStartX = PAD + 10
  const spineUsable = (nSlots + 1) * SLOT_GAP
  const spineEndX = spineStartX + spineUsable
  const effectX = spineEndX + 10

  // Vertical extent: bone reach + room for category label and sub-causes.
  const subMax = categories.reduce((m, c) => Math.max(m, c.children.length), 0)
  const reach = BONE_LEN * SIN + 24 + (subMax + 1) * (fontS + 5) + 14
  const spineY = reach + PAD
  const width = effectX + effW + PAD
  const height = spineY + reach + PAD

  const parts: string[] = []
  parts.push(svgOpenTag(width, height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  parts.push('<defs>')
  parts.push(
    `  <marker id="ishikawa-head" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto-start-reverse">` +
    `\n    <polygon points="0 0, 10 4, 0 8" fill="var(--_line)" />` +
    `\n  </marker>`,
  )
  parts.push('</defs>')

  // Spine (points right, into the effect box).
  parts.push(
    `<line x1="${spineStartX}" y1="${spineY}" x2="${effectX}" y2="${spineY}" ` +
    `stroke="var(--_line)" stroke-width="2" marker-end="url(#ishikawa-head)" />`,
  )

  // Effect box.
  parts.push(
    `<g class="ishikawa-effect">` +
    `\n  <rect x="${effectX}" y="${spineY - effH / 2}" width="${effW}" height="${effH}" rx="8" ry="8" ` +
    `fill="color-mix(in srgb, ${ACCENT} 30%, var(--bg))" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />` +
    `\n  ${renderMultilineText(effect, effectX + effW / 2, spineY, catFont,
      `text-anchor="middle" font-size="${catFont}" font-weight="700" fill="var(--_text)"`)}` +
    `\n</g>`,
  )

  // Category bones (alternating top/bottom).
  categories.forEach((cat, i) => {
    const top = i % 2 === 0
    const attachX = spineStartX + (i + 1) * SLOT_GAP
    const dir = top ? -1 : 1
    const tipX = attachX - BONE_LEN * COS
    const tipY = spineY + dir * BONE_LEN * SIN

    // Bone line.
    parts.push(
      `<line class="ishikawa-bone" x1="${attachX}" y1="${spineY}" x2="${tipX}" y2="${tipY}" ` +
      `stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.connector}" />`,
    )

    // Category label box at the tip.
    const labelW = Math.max(70, estimateTextWidth(cat.text, fontS + 1, 600) + 18)
    const labelH = 24
    const lx = tipX - labelW / 2
    const ly = top ? tipY - labelH : tipY
    parts.push(
      `<g class="ishikawa-category">` +
      `\n  <rect x="${lx}" y="${ly}" width="${labelW}" height="${labelH}" rx="5" ry="5" ` +
      `fill="color-mix(in srgb, ${ACCENT} 18%, var(--bg))" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.innerBox}" />` +
      `\n  ${renderMultilineText(cat.text, tipX, ly + labelH / 2, fontS + 1,
        `text-anchor="middle" font-size="${fontS + 1}" font-weight="600" fill="var(--_text)"`)}` +
      `\n</g>`,
    )

    // Sub-causes listed beyond the tip (away from the spine).
    let sy = top ? ly - 4 - fontS : ly + labelH + 4 + fontS
    const step = top ? -(fontS + 5) : fontS + 5
    for (const child of cat.children) {
      parts.push(
        `<text x="${tipX}" y="${sy}" dy="0.35em" text-anchor="middle" ` +
        `font-size="${fontS}" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-muted)">${esc(child.text)}</text>`,
      )
      sy += step
    }
  })

  parts.push('</svg>')
  return parts.join('\n')
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
