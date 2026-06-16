import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS } from '../styles.ts'
import { renderMultilineText, normalizeBrTags } from '../multiline-utils.ts'

// ============================================================================
// Quadrant chart (native)
//
// Mermaid `quadrantChart` syntax:
//   quadrantChart
//     title Reach and engagement
//     x-axis Low Reach --> High Reach
//     y-axis Low Engagement --> High Engagement
//     quadrant-1 We should expand
//     quadrant-2 Need to promote
//     quadrant-3 Re-evaluate
//     quadrant-4 May be improved
//     Campaign A: [0.3, 0.6]
//     Campaign B: [0.45, 0.23]
//
// A 2×2 grid in normalized 0..1 space. Quadrant 1=top-right, 2=top-left,
// 3=bottom-left, 4=bottom-right. Axis/quadrant tints come from the theme accent.
// ============================================================================

interface Point {
  name: string
  x: number
  y: number
}
interface QuadrantModel {
  title?: string
  xLeft?: string
  xRight?: string
  yBottom?: string
  yTop?: string
  q1?: string
  q2?: string
  q3?: string
  q4?: string
  points: Point[]
}

const PAD = 24
const TITLE_H = 30
const AXIS_GAP = 22 // space reserved outside the plot for axis labels
const SIDE = 400 // plot square side
const POINT_R = 5

const ACCENT = 'var(--accent, var(--_line))'
const qFillA = `color-mix(in srgb, ${ACCENT} 8%, var(--bg))`
const qFillB = `color-mix(in srgb, ${ACCENT} 15%, var(--bg))`

function parse(lines: string[]): QuadrantModel {
  const model: QuadrantModel = { points: [] }
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!
    let m: RegExpMatchArray | null

    if ((m = line.match(/^title\s+(.+)$/i))) { model.title = normalizeBrTags(m[1]!.trim()); continue }

    if ((m = line.match(/^x-axis\s+(.+)$/i))) {
      const [l, r] = splitAxis(m[1]!)
      model.xLeft = l; model.xRight = r
      continue
    }
    if ((m = line.match(/^y-axis\s+(.+)$/i))) {
      const [l, r] = splitAxis(m[1]!)
      model.yBottom = l; model.yTop = r
      continue
    }
    if ((m = line.match(/^quadrant-1\s+(.+)$/i))) { model.q1 = normalizeBrTags(m[1]!.trim()); continue }
    if ((m = line.match(/^quadrant-2\s+(.+)$/i))) { model.q2 = normalizeBrTags(m[1]!.trim()); continue }
    if ((m = line.match(/^quadrant-3\s+(.+)$/i))) { model.q3 = normalizeBrTags(m[1]!.trim()); continue }
    if ((m = line.match(/^quadrant-4\s+(.+)$/i))) { model.q4 = normalizeBrTags(m[1]!.trim()); continue }

    // Data point: "Name: [x, y]" (optional :::class and trailing color/radius — ignored for brand consistency)
    if ((m = line.match(/^(.+?):\s*\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]/))) {
      const name = normalizeBrTags(m[1]!.replace(/:::\S+/, '').trim())
      model.points.push({ name, x: clamp01(parseFloat(m[2]!)), y: clamp01(parseFloat(m[3]!)) })
      continue
    }
  }
  return model
}

function splitAxis(s: string): [string, string | undefined] {
  const parts = s.split('-->')
  const left = normalizeBrTags(parts[0]!.trim())
  const right = parts[1] != null ? normalizeBrTags(parts[1].trim()) : undefined
  return [left, right]
}

const clamp01 = (n: number) => (isNaN(n) ? 0 : Math.max(0, Math.min(1, n)))

export function renderQuadrantSvg(
  lines: string[],
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const model = parse(lines)

  const titleH = model.title ? TITLE_H : 0
  const hasYLabels = !!(model.yBottom || model.yTop)
  const hasXLabels = !!(model.xLeft || model.xRight)

  const leftPad = PAD + (hasYLabels ? AXIS_GAP : 0)
  const plotX = leftPad
  const plotY = PAD + titleH
  const plotW = SIDE
  const plotH = SIDE

  const width = plotX + plotW + PAD
  const height = plotY + plotH + (hasXLabels ? AXIS_GAP : 0) + PAD

  const cx = plotX + plotW / 2
  const cy = plotY + plotH / 2

  const parts: string[] = []
  parts.push(svgOpenTag(width, height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  // Title.
  if (model.title) {
    parts.push(
      renderMultilineText(model.title, plotX + plotW / 2, PAD + TITLE_H / 2 - 4, FONT_SIZES.nodeLabel + 3,
        `text-anchor="middle" font-size="${FONT_SIZES.nodeLabel + 3}" font-weight="700" fill="var(--_text)"`),
    )
  }

  // Quadrant background tints (checkerboard for subtle distinction):
  //   Q2 top-left, Q1 top-right, Q3 bottom-left, Q4 bottom-right.
  const half = plotW / 2
  const cells: Array<[number, number, string]> = [
    [plotX, plotY, qFillB],            // Q2 top-left
    [plotX + half, plotY, qFillA],     // Q1 top-right
    [plotX, plotY + half, qFillA],     // Q3 bottom-left
    [plotX + half, plotY + half, qFillB], // Q4 bottom-right
  ]
  for (const [x, y, fill] of cells) {
    parts.push(`<rect x="${x}" y="${y}" width="${half}" height="${half}" fill="${fill}" />`)
  }

  // Outer frame + dividing lines.
  parts.push(
    `<rect x="${plotX}" y="${plotY}" width="${plotW}" height="${plotH}" fill="none" ` +
    `stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />`,
  )
  parts.push(`<line x1="${cx}" y1="${plotY}" x2="${cx}" y2="${plotY + plotH}" stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.innerBox}" />`)
  parts.push(`<line x1="${plotX}" y1="${cy}" x2="${plotX + plotW}" y2="${cy}" stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.innerBox}" />`)

  // Quadrant labels — near the top of each quadrant.
  const qLabel = (text: string | undefined, lx: number, ly: number) => {
    if (!text) return
    parts.push(
      renderMultilineText(text, lx, ly, FONT_SIZES.edgeLabel + 1,
        `text-anchor="middle" font-size="${FONT_SIZES.edgeLabel + 1}" font-weight="600" fill="var(--_text-sec)"`),
    )
  }
  qLabel(model.q2, plotX + half / 2, plotY + 18)
  qLabel(model.q1, plotX + half + half / 2, plotY + 18)
  qLabel(model.q3, plotX + half / 2, plotY + half + 18)
  qLabel(model.q4, plotX + half + half / 2, plotY + half + 18)

  // Axis labels.
  if (model.xLeft) {
    parts.push(
      `<text x="${plotX + 4}" y="${plotY + plotH + AXIS_GAP - 6}" text-anchor="start" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="600" fill="var(--_text-muted)">${esc(model.xLeft)}</text>`,
    )
  }
  if (model.xRight) {
    parts.push(
      `<text x="${plotX + plotW - 4}" y="${plotY + plotH + AXIS_GAP - 6}" text-anchor="end" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="600" fill="var(--_text-muted)">${esc(model.xRight)}</text>`,
    )
  }
  if (model.yBottom) {
    const yx = plotX - 8, yy = plotY + plotH - 4
    parts.push(
      `<text x="${yx}" y="${yy}" text-anchor="start" transform="rotate(-90 ${yx} ${yy})" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="600" fill="var(--_text-muted)">${esc(model.yBottom)}</text>`,
    )
  }
  if (model.yTop) {
    const yx = plotX - 8, yy = plotY + 4
    parts.push(
      `<text x="${yx}" y="${yy}" text-anchor="end" transform="rotate(-90 ${yx} ${yy})" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="600" fill="var(--_text-muted)">${esc(model.yTop)}</text>`,
    )
  }

  // Data points.
  for (const p of model.points) {
    const px = plotX + p.x * plotW
    const py = plotY + (1 - p.y) * plotH
    parts.push(
      `<g class="quadrant-point">` +
      `\n  <circle cx="${px}" cy="${py}" r="${POINT_R}" fill="${ACCENT}" stroke="var(--bg)" stroke-width="1" />` +
      `\n  <text x="${px + POINT_R + 4}" y="${py}" dy="0.35em" text-anchor="start" ` +
      `font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text)">${esc(p.name)}</text>` +
      `\n</g>`,
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
