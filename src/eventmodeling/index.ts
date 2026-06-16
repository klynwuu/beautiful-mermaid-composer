import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS, estimateTextWidth } from '../styles.ts'
import { renderMultilineText, normalizeBrTags } from '../multiline-utils.ts'

// ============================================================================
// Event modeling diagram (native)
//
// Mermaid `eventmodeling` syntax (compact / relaxed):
//   eventmodeling
//     tf 01 ui CartUI
//     tf 02 cmd AddItem
//     tf 03 evt ItemAdded
//     rf
//     tf 04 rmo Cart
//
// Three swimlanes by entity type: UI/Automation (ui, pcr), Command/Read Model
// (cmd, rmo), Events (evt). Time frames are columns left→right, connected in
// order (a `rf`/`resetframe` breaks the chain). Cards are theme-accent tints.
// ============================================================================

const LANES = [
  { key: 'ui', title: 'UI / Automation', types: ['ui', 'pcr', 'processor', 'automation'] },
  { key: 'cmd', title: 'Command / Read Model', types: ['cmd', 'command', 'rmo', 'readmodel'] },
  { key: 'evt', title: 'Events', types: ['evt', 'event'] },
] as const

// Per-type accent tint (percent into bg) so cards read distinctly on-brand.
const TYPE_MIX: Record<string, number> = {
  ui: 10, pcr: 14, processor: 14, automation: 12,
  cmd: 26, command: 26, rmo: 18, readmodel: 18,
  evt: 34, event: 34,
}
const ACCENT = 'var(--accent, var(--_line))'

interface Frame {
  type: string
  label: string
  lane: number
  col: number
}

const PAD = 24
const LANE_LABEL_W = 130
const LANE_H = 92
const COL_DX = 150
const CARD_W = 118
const CARD_H = 44

function laneForType(type: string): number {
  const t = type.toLowerCase()
  for (let i = 0; i < LANES.length; i++) if ((LANES[i]!.types as readonly string[]).includes(t)) return i
  return 0
}

function parse(lines: string[]): { frames: Frame[]; links: Array<[number, number]> } {
  const frames: Frame[] = []
  const links: Array<[number, number]> = []
  let col = 0
  let prev = -1
  let broken = false

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!
    if (/^(rf|resetframe)\b/i.test(line)) { broken = true; continue }

    const m = line.match(/^(?:tf|timeframe)\s+(\S+)\s+(\S+)\s+(.+?)(?:\s*\{.*)?(?:\s*\[\[.*)?$/i)
    if (!m) continue
    const type = m[2]!
    // Use the entity name after any namespace prefix as the card label.
    const rawId = m[3]!.trim()
    const label = normalizeBrTags(rawId.includes('.') ? rawId.slice(rawId.lastIndexOf('.') + 1) : rawId)
    const idx = frames.length
    frames.push({ type, label, lane: laneForType(type), col: col++ })
    if (prev >= 0 && !broken) links.push([prev, idx])
    prev = idx
    broken = false
  }

  return { frames, links }
}

export function renderEventModelingSvg(
  lines: string[],
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const { frames, links } = parse(lines)

  const ncols = frames.reduce((m, f) => Math.max(m, f.col + 1), 0)
  const plotLeft = PAD + LANE_LABEL_W
  const laneTop = PAD
  const width = plotLeft + Math.max(1, ncols) * COL_DX + PAD
  const height = laneTop + LANES.length * LANE_H + PAD

  const laneY = (lane: number) => laneTop + lane * LANE_H
  const cardX = (col: number) => plotLeft + col * COL_DX + (COL_DX - CARD_W) / 2
  const cardY = (lane: number) => laneY(lane) + (LANE_H - CARD_H) / 2
  const card = (f: Frame) => ({
    x: cardX(f.col),
    y: cardY(f.lane),
    cx: cardX(f.col) + CARD_W / 2,
    cy: cardY(f.lane) + CARD_H / 2,
  })

  const parts: string[] = []
  parts.push(svgOpenTag(width, height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  parts.push('<defs>')
  parts.push(
    `  <marker id="em-arrow" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto-start-reverse">` +
    `\n    <polygon points="0 0, 9 3.5, 0 7" fill="var(--_line)" />` +
    `\n  </marker>`,
  )
  parts.push('</defs>')

  // Swimlane bands + labels.
  LANES.forEach((lane, i) => {
    const y = laneY(i)
    const fill = i % 2 === 0 ? 'color-mix(in srgb, var(--fg) 3%, var(--bg))' : 'var(--bg)'
    parts.push(
      `<g class="em-lane">` +
      `\n  <rect x="${PAD}" y="${y}" width="${width - PAD * 2}" height="${LANE_H}" fill="${fill}" ` +
      `stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.innerBox}" />` +
      `\n  ${renderMultilineText(lane.title, PAD + LANE_LABEL_W / 2, y + LANE_H / 2, FONT_SIZES.edgeLabel + 1,
        `text-anchor="middle" font-size="${FONT_SIZES.edgeLabel + 1}" font-weight="700" fill="var(--_text-sec)"`)}` +
      `\n</g>`,
    )
  })

  // Connectors (behind cards).
  for (const [a, b] of links) {
    const ca = card(frames[a]!)
    const cb = card(frames[b]!)
    parts.push(connector(ca, cb))
  }

  // Cards.
  for (const f of frames) {
    const c = card(f)
    const mix = TYPE_MIX[f.type.toLowerCase()] ?? 16
    parts.push(
      `<g class="em-frame" data-type="${escAttr(f.type)}">` +
      `\n  <rect x="${c.x}" y="${c.y}" width="${CARD_W}" height="${CARD_H}" rx="5" ry="5" ` +
      `fill="color-mix(in srgb, ${ACCENT} ${mix}%, var(--bg))" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />` +
      `\n  ${renderMultilineText(f.label, c.cx, c.cy, FONT_SIZES.edgeLabel,
        `text-anchor="middle" font-size="${FONT_SIZES.edgeLabel}" font-weight="600" fill="var(--_text)"`)}` +
      `\n</g>`,
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

/** Orthogonal connector between two card centers, exiting right / entering left. */
function connector(a: { x: number; y: number; cx: number; cy: number }, b: { x: number; y: number; cx: number; cy: number }): string {
  const startX = a.x + CARD_W
  const endX = b.x
  const startY = a.cy
  const endY = b.cy
  if (startY === endY) {
    return `<line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.connector}" marker-end="url(#em-arrow)" />`
  }
  const midX = (startX + endX) / 2
  const d = `M ${startX},${startY} L ${midX},${startY} L ${midX},${endY} L ${endX},${endY}`
  return `<path d="${d}" fill="none" stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.connector}" marker-end="url(#em-arrow)" />`
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
