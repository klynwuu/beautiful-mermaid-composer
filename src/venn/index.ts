import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS } from '../styles.ts'
import { renderMultilineText, normalizeBrTags } from '../multiline-utils.ts'

// ============================================================================
// Venn diagram (native)
//
// Mermaid `venn-beta` syntax:
//   venn-beta
//     set A ["Set Alpha"]
//     set B ["Set Beta"]
//     union A, B
//       text ["Both"]
//
// Rendered as 1–3 overlapping translucent circles (canonical layouts) so the
// overlap regions read naturally. A union's `text` lands in the intersection.
// Circle fills/strokes are theme-accent based so future themes recolor it.
// ============================================================================

interface VennSet {
  id: string
  label: string
  text: string[]
}
interface VennUnion {
  ids: string[]
  text: string[]
}
interface VennModel {
  title?: string
  sets: VennSet[]
  unions: VennUnion[]
}

const PAD = 30
const TITLE_H = 30
const R = 95 // circle radius
const ACCENT = 'var(--accent, var(--_line))'

function parse(lines: string[]): VennModel {
  const model: VennModel = { sets: [], unions: [] }
  let target: { text: string[] } | null = null

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!
    let m: RegExpMatchArray | null

    if ((m = line.match(/^title\s+(.+)$/i))) { model.title = normalizeBrTags(m[1]!.trim()); continue }

    // set <id> ["label"] [:size]
    if ((m = line.match(/^set\s+(.+)$/i))) {
      const rest = m[1]!.trim()
      const lm = rest.match(/^("[^"]*"|\S+)(?:\s*\[\s*"([^"]*)"\s*\])?/)
      const id = (lm?.[1] ?? rest).replace(/^"|"$/g, '')
      const label = lm?.[2] != null ? normalizeBrTags(lm[2]) : id
      const set: VennSet = { id, label, text: [] }
      model.sets.push(set)
      target = set
      continue
    }

    // union A, B[, C] [:size]
    if ((m = line.match(/^union\s+(.+)$/i))) {
      const ids = m[1]!.replace(/:\s*\d+\s*$/, '').split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean)
      const u: VennUnion = { ids, text: [] }
      model.unions.push(u)
      target = u
      continue
    }

    // text ["label"] — attaches to the most recent set/union
    if ((m = line.match(/^text\s+\[\s*"([^"]*)"\s*\]/i)) && target) {
      target.text.push(normalizeBrTags(m[1]!))
      continue
    }
    // bare quoted text also attaches
    if ((m = line.match(/^"([^"]*)"$/)) && target) {
      target.text.push(normalizeBrTags(m[1]!))
      continue
    }
    // style lines and anything else are ignored (theme drives styling).
  }
  return model
}

export function renderVennSvg(
  lines: string[],
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const model = parse(lines)
  const n = model.sets.length

  const titleH = model.title ? TITLE_H : 0
  // Canonical circle centers within a working box, then offset by padding.
  const centers = circleCenters(n)
  // Compute bounds.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const c of centers) {
    minX = Math.min(minX, c.x - R); maxX = Math.max(maxX, c.x + R)
    minY = Math.min(minY, c.y - R); maxY = Math.max(maxY, c.y + R)
  }
  if (!isFinite(minX)) { minX = 0; maxX = R * 2; minY = 0; maxY = R * 2 }

  const offX = PAD - minX
  const offY = PAD + titleH - minY
  const width = (maxX - minX) + PAD * 2
  const height = (maxY - minY) + PAD * 2 + titleH

  const cs = centers.map(c => ({ x: c.x + offX, y: c.y + offY }))
  const centroid = {
    x: cs.reduce((a, c) => a + c.x, 0) / Math.max(1, cs.length),
    y: cs.reduce((a, c) => a + c.y, 0) / Math.max(1, cs.length),
  }

  const parts: string[] = []
  parts.push(svgOpenTag(width, height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  if (model.title) {
    parts.push(
      renderMultilineText(model.title, width / 2, PAD + TITLE_H / 2 - 4, FONT_SIZES.nodeLabel + 3,
        `text-anchor="middle" font-size="${FONT_SIZES.nodeLabel + 3}" font-weight="700" fill="var(--_text)"`),
    )
  }

  // Translucent circles — overlaps darken naturally via fill-opacity.
  model.sets.forEach((_set, i) => {
    const c = cs[i]!
    parts.push(
      `<circle class="venn-set" cx="${c.x}" cy="${c.y}" r="${R}" ` +
      `fill="${ACCENT}" fill-opacity="0.22" stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.outerBox}" />`,
    )
  })

  // Set labels + exclusive text, pushed outward from the centroid.
  model.sets.forEach((set, i) => {
    const c = cs[i]!
    let dx = c.x - centroid.x
    let dy = c.y - centroid.y
    const len = Math.hypot(dx, dy) || 1
    const push = n === 1 ? 0 : R * 0.55
    const lx = c.x + (dx / len) * push
    const ly = c.y + (dy / len) * push
    const lines2 = [set.label, ...set.text].join('\n')
    parts.push(
      renderMultilineText(lines2, lx, ly, FONT_SIZES.nodeLabel,
        `text-anchor="middle" font-size="${FONT_SIZES.nodeLabel}" font-weight="700" fill="var(--_text)"`),
    )
  })

  // Union text → placed at the centroid of the involved circles (the overlap).
  for (const u of model.unions) {
    if (u.text.length === 0) continue
    const idxs = u.ids.map(id => model.sets.findIndex(s => s.id === id)).filter(i => i >= 0)
    if (idxs.length === 0) continue
    const ux = idxs.reduce((a, i) => a + cs[i]!.x, 0) / idxs.length
    const uy = idxs.reduce((a, i) => a + cs[i]!.y, 0) / idxs.length
    parts.push(
      renderMultilineText(u.text.join('\n'), ux, uy, FONT_SIZES.edgeLabel,
        `text-anchor="middle" font-size="${FONT_SIZES.edgeLabel}" font-weight="600" fill="var(--_text)"`),
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

/** Canonical center layouts for 1–3 sets; ≥4 falls back to a horizontal row. */
function circleCenters(n: number): Array<{ x: number; y: number }> {
  if (n <= 1) return [{ x: 0, y: 0 }]
  if (n === 2) {
    const d = R * 0.62
    return [{ x: -d, y: 0 }, { x: d, y: 0 }]
  }
  if (n === 3) {
    const d = R * 0.66
    return [
      { x: 0, y: -d },
      { x: -d * 0.87, y: d * 0.5 },
      { x: d * 0.87, y: d * 0.5 },
    ]
  }
  // ≥4 sets: lay out in a non-overlapping row (rare; venn is meant for 2–3).
  const out: Array<{ x: number; y: number }> = []
  for (let i = 0; i < n; i++) out.push({ x: i * (R * 2 + 12), y: 0 })
  return out
}
