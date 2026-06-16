import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS, estimateTextWidth } from '../styles.ts'
import { measureMultilineText } from '../text-metrics.ts'
import { renderMultilineText, normalizeBrTags } from '../multiline-utils.ts'

// ============================================================================
// Timeline diagram (native)
//
// Mermaid `timeline` syntax:
//   timeline
//     title My day
//     section Morning
//       09:00 : Wake up : Coffee
//             : Shower
//     section Work
//       12:00 : Lunch
//
// Layout (left-to-right): a title, then a row of colored section bands; under
// each section its time periods sit as columns, and under each period label its
// events stack as cards. All colors come from theme CSS variables (a tint of
// the brand accent) so any future theme re-colors the whole diagram.
// ============================================================================

interface Period {
  label: string
  events: string[]
}
interface Section {
  name: string
  periods: Period[]
}
interface TimelineModel {
  title?: string
  sections: Section[]
}

interface Box {
  text: string
  x: number
  y: number
  width: number
  height: number
  color: number
}

const PAD = 24
const TITLE_H = 30
const SECTION_H = 34
const PERIOD_H = 30
const GAP = 10
const COL_GAP = 14
const AXIS_GAP = 26 // vertical space between the period row / axis / events
const CARD_PAD_X = 12
const CARD_PAD_Y = 8
const MIN_COL_W = 110
const MAX_TEXT_W = 180

// Per-section accent tints (percent of accent mixed into bg). Cycles so each
// section reads distinctly while staying within the active theme's palette.
const ACCENT = 'var(--accent, var(--_line))'
const SECTION_MIX = [34, 22, 44, 16, 38, 28]
const CARD_MIX = [16, 11, 20, 8, 18, 13]
const sectionFill = (i: number) => `color-mix(in srgb, ${ACCENT} ${SECTION_MIX[i % SECTION_MIX.length]}%, var(--bg))`
const cardFill = (i: number) => `color-mix(in srgb, ${ACCENT} ${CARD_MIX[i % CARD_MIX.length]}%, var(--bg))`

function parse(lines: string[]): TimelineModel {
  const model: TimelineModel = { sections: [] }
  let current: Section | null = null
  let lastPeriod: Period | null = null

  const ensureSection = (): Section => {
    if (!current) {
      current = { name: '', periods: [] }
      model.sections.push(current)
    }
    return current
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!
    const titleMatch = line.match(/^title\s+(.+)$/i)
    if (titleMatch) {
      model.title = normalizeBrTags(titleMatch[1]!.trim())
      continue
    }
    const sectionMatch = line.match(/^section\s+(.+)$/i)
    if (sectionMatch) {
      current = { name: normalizeBrTags(sectionMatch[1]!.trim()), periods: [] }
      model.sections.push(current)
      lastPeriod = null
      continue
    }

    if (line.includes(':')) {
      const idx = line.indexOf(':')
      const left = line.slice(0, idx).trim()
      const events = line
        .slice(idx + 1)
        .split(':')
        .map(s => normalizeBrTags(s.trim()))
        .filter(Boolean)
      if (left) {
        // New time period.
        const section = ensureSection()
        lastPeriod = { label: normalizeBrTags(left), events }
        section.periods.push(lastPeriod)
      } else if (lastPeriod) {
        // Continuation line (": event") appends to the previous period.
        lastPeriod.events.push(...events)
      }
      continue
    }

    // A bare line is a time period with no events.
    const section = ensureSection()
    lastPeriod = { label: normalizeBrTags(line), events: [] }
    section.periods.push(lastPeriod)
  }

  return model
}

export function renderTimelineSvg(
  lines: string[],
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const model = parse(lines)

  const sectionBoxes: Box[] = []
  const periodBoxes: Box[] = []
  const eventBoxes: Box[] = []

  // Per-column connector anchors: { cx, eventsBottom }.
  const columns: Array<{ cx: number; eventsBottom: number }> = []

  const hasSections = model.sections.some(s => s.name)
  const titleH = model.title ? TITLE_H : 0
  const topY = PAD + titleH
  const periodY = topY + (hasSections ? SECTION_H + GAP : 0)
  const axisY = periodY + PERIOD_H + AXIS_GAP
  const eventsY = axisY + AXIS_GAP

  // Card height for a (possibly multi-line) event text.
  const cardHeight = (text: string): number =>
    measureMultilineText(text, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel).height + CARD_PAD_Y * 2

  // Column width for a period: widest of its label and its event cards.
  const colWidth = (p: Period): number => {
    let w = estimateTextWidth(p.label, FONT_SIZES.nodeLabel, FONT_WEIGHTS.nodeLabel)
    for (const e of p.events) {
      const ew = Math.min(
        MAX_TEXT_W,
        measureMultilineText(e, FONT_SIZES.edgeLabel, FONT_WEIGHTS.edgeLabel).width,
      )
      w = Math.max(w, ew)
    }
    return Math.max(MIN_COL_W, w + CARD_PAD_X * 2)
  }

  let cursorX = PAD
  let maxBottom = eventsY

  model.sections.forEach((section, si) => {
    const periodWidths = section.periods.map(colWidth)
    const sectionW = periodWidths.reduce((a, b) => a + b, 0) + COL_GAP * Math.max(0, section.periods.length - 1)
    const sectionX = cursorX

    if (section.name) {
      sectionBoxes.push({ text: section.name, x: sectionX, y: topY, width: sectionW, height: SECTION_H, color: si })
    }

    let colX = sectionX
    section.periods.forEach((period, pi) => {
      const w = periodWidths[pi]!
      periodBoxes.push({ text: period.label, x: colX, y: periodY, width: w, height: PERIOD_H, color: si })

      let ey = eventsY
      for (const ev of period.events) {
        const h = cardHeight(ev)
        eventBoxes.push({ text: ev, x: colX, y: ey, width: w, height: h, color: si })
        ey += h + GAP
      }
      const eventsBottom = period.events.length > 0 ? ey - GAP : eventsY
      columns.push({ cx: colX + w / 2, eventsBottom })
      maxBottom = Math.max(maxBottom, ey)
      colX += w + COL_GAP
    })

    cursorX = sectionX + sectionW + COL_GAP * 2
  })

  const connectorBottom = columns.reduce((m, c) => Math.max(m, c.eventsBottom), eventsY) + 16
  const width = Math.max(cursorX - COL_GAP * 2 + PAD, 200)
  const height = Math.max(maxBottom, connectorBottom) + PAD

  // ---- Render ----
  const parts: string[] = []
  parts.push(svgOpenTag(width, height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push('<defs>')
  parts.push(
    `  <marker id="timeline-arrow" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto-start-reverse">` +
    `\n    <polygon points="0 0, 9 4, 0 8" fill="var(--_line)" />` +
    `\n  </marker>`,
  )
  parts.push('</defs>')

  if (model.title) {
    parts.push(
      renderMultilineText(model.title, width / 2, PAD + TITLE_H / 2 - 4, FONT_SIZES.nodeLabel + 3,
        `text-anchor="middle" font-size="${FONT_SIZES.nodeLabel + 3}" font-weight="700" fill="var(--_text)"`),
    )
  }

  // Time axis + dashed connectors (behind the boxes/cards drawn afterwards).
  //   period box --(dashed)--> axis --(dashed, arrow)--> events
  for (const col of columns) {
    parts.push(
      `<line x1="${col.cx}" y1="${periodY + PERIOD_H}" x2="${col.cx}" y2="${axisY}" ` +
      `stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.innerBox}" stroke-dasharray="3 3" />`,
    )
    parts.push(
      `<line x1="${col.cx}" y1="${axisY}" x2="${col.cx}" y2="${col.eventsBottom + 14}" ` +
      `stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.innerBox}" stroke-dasharray="3 3" marker-end="url(#timeline-arrow)" />`,
    )
  }
  parts.push(
    `<line class="timeline-axis" x1="${PAD}" y1="${axisY}" x2="${width - PAD}" y2="${axisY}" ` +
    `stroke="var(--_line)" stroke-width="2" marker-end="url(#timeline-arrow)" />`,
  )

  // Section bands.
  for (const b of sectionBoxes) {
    parts.push(
      `<g class="timeline-section">` +
      `\n  <rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="6" ry="6" ` +
      `fill="${sectionFill(b.color)}" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />` +
      `\n  ${renderMultilineText(b.text, b.x + b.width / 2, b.y + b.height / 2, FONT_SIZES.nodeLabel,
        `text-anchor="middle" font-size="${FONT_SIZES.nodeLabel}" font-weight="700" fill="var(--_text)"`)}` +
      `\n</g>`,
    )
  }

  // Period labels.
  for (const b of periodBoxes) {
    parts.push(
      `<g class="timeline-period">` +
      `\n  <rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="5" ry="5" ` +
      `fill="${sectionFill(b.color)}" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.innerBox}" />` +
      `\n  ${renderMultilineText(b.text, b.x + b.width / 2, b.y + b.height / 2, FONT_SIZES.edgeLabel + 1,
        `text-anchor="middle" font-size="${FONT_SIZES.edgeLabel + 1}" font-weight="600" fill="var(--_text)"`)}` +
      `\n</g>`,
    )
  }

  // Event cards.
  for (const b of eventBoxes) {
    parts.push(
      `<g class="timeline-event">` +
      `\n  <rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="5" ry="5" ` +
      `fill="${cardFill(b.color)}" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.innerBox}" />` +
      `\n  ${renderMultilineText(b.text, b.x + b.width / 2, b.y + b.height / 2, FONT_SIZES.edgeLabel,
        `text-anchor="middle" font-size="${FONT_SIZES.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text)"`)}` +
      `\n</g>`,
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}
