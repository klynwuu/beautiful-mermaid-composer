import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS, estimateTextWidth } from '../styles.ts'
import { renderMultilineText, normalizeBrTags } from '../multiline-utils.ts'

// ============================================================================
// Ishikawa / fishbone diagram (native)
//
// Mermaid `ishikawa` / `ishikawa-beta` syntax: the first content line is the
// effect (problem); indentation expresses an arbitrarily deep cause hierarchy:
//   ishikawa
//     Blurry Photo
//       Equipment
//         LENS
//           Dirty lens
//         SENSOR
//           Dirty sensor
//       Process
//         Out of focus
//
// Rendered as a horizontal spine pointing into the effect box on the right,
// category "bones" branching diagonally above/below the spine, and each
// category's sub-tree hung off its bone as horizontal sub-branches (sub-bone
// header + its causes). All strokes/fills are theme variables.
// ============================================================================

interface Node {
  text: string
  children: Node[]
}

const PAD = 26
const COS = 0.5 // cos 60°
const SIN = 0.866 // sin 60°
const ROW_H = 20 // vertical room per rendered cause row
const SUB_LEN = 30 // horizontal sub-branch length off the main bone
const BONE_MARGIN = 26 // extra bone beyond the category's rows
const SLOT_GAP = 36
const ACCENT = 'var(--accent, var(--_line))'

/** Build an arbitrarily-deep tree from leading-whitespace indentation. */
function parseTree(raw: string[]): { effect: string; categories: Node[] } {
  const items = raw
    .filter(l => l.trim().length > 0)
    .map(l => ({ indent: l.match(/^\s*/)![0].length, text: normalizeBrTags(l.trim()) }))
  if (items.length === 0) return { effect: '', categories: [] }

  const effect = items[0]!.text
  const categories: Node[] = []
  const stack: Array<{ indent: number; node: Node }> = []
  for (const it of items.slice(1)) {
    const node: Node = { text: it.text, children: [] }
    while (stack.length && stack[stack.length - 1]!.indent >= it.indent) stack.pop()
    if (stack.length === 0) categories.push(node)
    else stack[stack.length - 1]!.node.children.push(node)
    stack.push({ indent: it.indent, node })
  }
  return { effect, categories }
}

/** Depth-first list of a node's descendants (excludes the node itself). */
function descendants(node: Node): Node[] {
  const out: Node[] = []
  for (const c of node.children) {
    out.push(c)
    out.push(...descendants(c))
  }
  return out
}

/** Rendered row count for a category child: 1 (its header/label) + its descendants. */
const childRows = (child: Node) => 1 + descendants(child).length

export function renderIshikawaSvg(
  rawLines: string[],
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const { effect, categories } = parseTree(rawLines.slice(1))

  const fontS = FONT_SIZES.edgeLabel
  const catFont = FONT_SIZES.nodeLabel

  // Per-category geometry.
  const cats = categories.map(cat => {
    const rows = cat.children.reduce((a, c) => a + childRows(c), 0) || 1
    const bandH = rows * ROW_H
    const boneLen = (bandH + BONE_MARGIN) / SIN
    const run = boneLen * COS
    // Width the category occupies left of its spine attachment.
    let labelW = 0
    for (const child of cat.children) {
      labelW = Math.max(labelW, estimateTextWidth(child.text, fontS + 1, 600))
      for (const d of descendants(child)) labelW = Math.max(labelW, estimateTextWidth(d.text, fontS, 400))
    }
    return { cat, rows, bandH, boneLen, run, labelW }
  })

  // Lay categories left→right, alternating top/bottom.
  const effW = Math.max(120, estimateTextWidth(effect, catFont, 700) + 32)
  const effH = 56

  // Each category reaches left from its spine attachment by run + sub-branch +
  // label width; place attach points so that reach never clips the left edge.
  let x = PAD
  const placed = cats.map((c, i) => {
    const reach = c.run + SUB_LEN + c.labelW
    const attachX = x + reach
    x = attachX + SLOT_GAP
    return { ...c, attachX, top: i % 2 === 0 }
  })

  const spineEndX = (placed.length ? placed[placed.length - 1]!.attachX : PAD) + 40
  const effectX = spineEndX + 8

  const maxBand = placed.reduce((m, p) => Math.max(m, p.bandH + BONE_MARGIN), 60)
  const spineY = PAD + maxBand
  const width = effectX + effW + PAD
  const height = spineY + maxBand + PAD

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

  // Spine (points right into the effect box).
  parts.push(
    `<line x1="${PAD}" y1="${spineY}" x2="${effectX}" y2="${spineY}" ` +
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

  for (const p of placed) {
    const dir = p.top ? -1 : 1
    const attach = { x: p.attachX, y: spineY }
    const tip = { x: p.attachX - p.run, y: spineY + dir * p.boneLen * SIN }

    // Main category bone.
    parts.push(
      `<line class="ishikawa-bone" x1="${attach.x}" y1="${attach.y}" x2="${tip.x}" y2="${tip.y}" ` +
      `stroke="var(--_line)" stroke-width="2" />`,
    )

    // Category label box at the tip.
    const clW = Math.max(74, estimateTextWidth(p.cat.text, catFont, 700) + 18)
    const clH = 26
    const cly = p.top ? tip.y - clH : tip.y
    parts.push(
      `<g class="ishikawa-category">` +
      `\n  <rect x="${tip.x - clW / 2}" y="${cly}" width="${clW}" height="${clH}" rx="5" ry="5" ` +
      `fill="color-mix(in srgb, ${ACCENT} 18%, var(--bg))" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.innerBox}" />` +
      `\n  ${renderMultilineText(p.cat.text, tip.x, cly + clH / 2, catFont,
        `text-anchor="middle" font-size="${catFont}" font-weight="700" fill="var(--_text)"`)}` +
      `\n</g>`,
    )

    // Children hung along the bone, each in a vertical band sized to its rows.
    const totalRows = p.rows
    let rowCursor = 0
    for (const child of p.cat.children) {
      const rows = childRows(child)
      // Fraction along the bone for this child's band centre (0 near spine → 1 near tip).
      const f = totalRows > 0 ? (rowCursor + rows / 2) / totalRows : 0.5
      const frac = 0.16 + f * 0.78
      const bx = attach.x + (tip.x - attach.x) * frac
      const by = attach.y + (tip.y - attach.y) * frac
      rowCursor += rows

      // Horizontal sub-branch off the bone (pointing left, away from the spine).
      const qx = bx - SUB_LEN
      parts.push(
        `<line x1="${bx}" y1="${by}" x2="${qx}" y2="${by}" stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.connector}" />`,
      )

      // Sub-tree text block: header (sub-cause/category) + its descendants, stacked.
      const descs = descendants(child)
      const blockRows = 1 + descs.length
      let ty = by - ((blockRows - 1) / 2) * ROW_H
      const labelRight = qx - 6
      parts.push(
        `<text x="${labelRight}" y="${ty}" dy="0.35em" text-anchor="end" ` +
        `font-size="${fontS + 1}" font-weight="${descs.length ? 700 : FONT_WEIGHTS.edgeLabel}" ` +
        `fill="${descs.length ? 'var(--_text)' : 'var(--_text-muted)'}">${esc(child.text)}</text>`,
      )
      for (const d of descs) {
        ty += ROW_H
        parts.push(
          `<text x="${labelRight - 10}" y="${ty}" dy="0.35em" text-anchor="end" ` +
          `font-size="${fontS}" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-muted)">${esc(d.text)}</text>`,
        )
      }
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
