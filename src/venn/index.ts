import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS } from '../styles.ts'
import { renderMultilineText, normalizeBrTags } from '../multiline-utils.ts'

// ============================================================================
// Venn diagram (native)
//
// Mermaid `venn-beta` syntax:
//   venn-beta
//     set A ["Set Alpha"]:20
//       text A1 ["React"]
//     set B ["Beta"]:12
//     union A, B ["AB"]:3
//     style A fill:#ff6b6b
//     style A,B color:#333
//
// Rendered as 1–3 overlapping circles. Radii scale with each set's size; set
// and union labels sit in their regions, with attached `text` nodes stacked
// beneath. Explicit `style fill/color/stroke` overrides are honored; anything
// unstyled falls back to theme variables so future themes recolor it.
// ============================================================================

interface Txt { id?: string; label: string }
interface VennSet { id: string; label: string; size?: number; text: Txt[] }
interface VennUnion { ids: string[]; label?: string; size?: number; text: Txt[] }
interface Style { fill?: string; color?: string; stroke?: string; strokeWidth?: string; fillOpacity?: string }

interface VennModel {
  title?: string
  sets: VennSet[]
  unions: VennUnion[]
  styles: Map<string, Style>
}

const PAD = 30
const TITLE_H = 30
const ACCENT = 'var(--accent, var(--_line))'
const DEFAULT_SIZE = 16

function parse(lines: string[]): VennModel {
  const model: VennModel = { sets: [], unions: [], styles: new Map() }
  let target: { text: Txt[] } | null = null

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!
    let m: RegExpMatchArray | null

    if ((m = line.match(/^title\s+(.+)$/i))) { model.title = normalizeBrTags(m[1]!.trim()); continue }

    // set <id> ["label"] :size  (label and size both optional; spaces optional)
    if ((m = line.match(/^set\s+([^\s[:]+)\s*(?:\[\s*"([^"]*)"\s*\])?\s*(?::\s*([\d.]+))?\s*$/i))) {
      const id = m[1]!
      const set: VennSet = {
        id,
        label: m[2] != null ? normalizeBrTags(m[2]) : id,
        size: m[3] != null ? parseFloat(m[3]) : undefined,
        text: [],
      }
      model.sets.push(set)
      target = set
      continue
    }

    // union A, B[, C] ["label"] :size
    if ((m = line.match(/^union\s+([^[\n]+?)\s*(?:\[\s*"([^"]*)"\s*\])?\s*(?::\s*([\d.]+))?\s*$/i))) {
      const ids = m[1]!.split(',').map(s => s.trim()).filter(Boolean)
      const u: VennUnion = {
        ids,
        label: m[2] != null ? normalizeBrTags(m[2]) : undefined,
        size: m[3] != null ? parseFloat(m[3]) : undefined,
        text: [],
      }
      model.unions.push(u)
      target = u
      continue
    }

    // text [id] ["label"]  — attaches to the most recent set/union
    if ((m = line.match(/^text\s+(?:([^\s[]+)\s*)?\[\s*"([^"]*)"\s*\]\s*$/i)) && target) {
      target.text.push({ id: m[1] || undefined, label: normalizeBrTags(m[2]!) })
      continue
    }
    if ((m = line.match(/^"([^"]*)"$/)) && target) {
      target.text.push({ label: normalizeBrTags(m[1]!) })
      continue
    }

    // style <id>[,<id>...] prop:val[,prop:val]
    if ((m = line.match(/^style\s+(\S+)\s+(.+)$/i))) {
      const ids = m[1]!.split(',').map(s => s.trim()).filter(Boolean)
      const style = parseStyle(m[2]!)
      for (const id of ids) model.styles.set(id, { ...model.styles.get(id), ...style })
      continue
    }
  }
  return model
}

function parseStyle(decls: string): Style {
  const style: Style = {}
  for (const part of decls.split(',')) {
    const idx = part.indexOf(':')
    if (idx < 0) continue
    const key = part.slice(0, idx).trim().toLowerCase()
    const val = part.slice(idx + 1).trim()
    if (key === 'fill') style.fill = val
    else if (key === 'color') style.color = val
    else if (key === 'stroke') style.stroke = val
    else if (key === 'stroke-width') style.strokeWidth = val
    else if (key === 'fill-opacity') style.fillOpacity = val
  }
  return style
}

const radiusForSize = (size: number | undefined): number => {
  const s = size ?? DEFAULT_SIZE
  return Math.max(55, Math.min(140, Math.sqrt(s) * 22))
}

export function renderVennSvg(
  lines: string[],
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const model = parse(lines)
  const n = model.sets.length
  const radii = model.sets.map(s => radiusForSize(s.size))

  // Union-driven layout: union pairs overlap (by an amount from the union's
  // value), non-union pairs are pushed apart.
  const setIndex = new Map(model.sets.map((s, i) => [s.id, i]))
  const unionPairs = new Map<string, number>()
  const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`)
  for (const u of model.unions) {
    const idxs = u.ids.map(id => setIndex.get(id)).filter((v): v is number => v != null)
    const frac = Math.max(0.2, Math.min(0.85, 0.2 + (u.size ?? 4) * 0.04))
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        const i = idxs[a]!, j = idxs[b]!
        unionPairs.set(pairKey(i, j), Math.min(radii[i]!, radii[j]!) * frac)
      }
    }
  }
  const centers = solveCenters(radii, unionPairs, pairKey)

  // Bounds.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  centers.forEach((c, i) => {
    const r = radii[i] ?? 80
    minX = Math.min(minX, c.x - r); maxX = Math.max(maxX, c.x + r)
    minY = Math.min(minY, c.y - r); maxY = Math.max(maxY, c.y + r)
  })
  if (!isFinite(minX)) { minX = 0; maxX = 160; minY = 0; maxY = 160 }

  const titleH = model.title ? TITLE_H : 0
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

  // Circles — explicit fill/stroke when styled, else translucent theme accent.
  model.sets.forEach((set, i) => {
    const c = cs[i]!
    const st = model.styles.get(set.id)
    const fill = st?.fill ?? ACCENT
    const fillOpacity = st?.fillOpacity ?? (st?.fill ? '0.35' : '0.22')
    const stroke = st?.stroke ?? st?.fill ?? 'var(--_line)'
    parts.push(
      `<circle class="venn-set" data-id="${escAttr(set.id)}" cx="${c.x}" cy="${c.y}" r="${radii[i]}" ` +
      `fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${st?.strokeWidth ?? STROKE_WIDTHS.outerBox}" />`,
    )
  })

  // Set labels + attached text, pushed outward from the centroid into the
  // set's exclusive region.
  model.sets.forEach((set, i) => {
    const c = cs[i]!
    const r = radii[i] ?? 80
    let dx = c.x - centroid.x
    let dy = c.y - centroid.y
    const len = Math.hypot(dx, dy) || 1
    const push = n === 1 ? 0 : r * 0.5
    const lx = n === 1 ? c.x : c.x + (dx / len) * push
    const ly = n === 1 ? c.y : c.y + (dy / len) * push

    const labelColor = model.styles.get(set.id)?.color ?? 'var(--_text)'
    parts.push(
      renderMultilineText(set.label, lx, ly, FONT_SIZES.nodeLabel + 1,
        `text-anchor="middle" font-size="${FONT_SIZES.nodeLabel + 1}" font-weight="700" fill="${labelColor}"`),
    )
    let ty = ly + 20
    for (const t of set.text) {
      const tColor = (t.id ? model.styles.get(t.id)?.color : undefined) ?? 'var(--_text-muted)'
      parts.push(
        `<text x="${lx}" y="${ty}" dy="0.35em" text-anchor="middle" font-size="${FONT_SIZES.edgeLabel}" ` +
        `font-weight="${FONT_WEIGHTS.edgeLabel}" fill="${tColor}">${esc(t.label)}</text>`,
      )
      ty += 18
    }
  })

  // Union labels + text → centroid of the involved circles (the overlap).
  for (const u of model.unions) {
    const idxs = u.ids.map(id => model.sets.findIndex(s => s.id === id)).filter(i => i >= 0)
    if (idxs.length === 0) continue
    const ux = idxs.reduce((a, i) => a + cs[i]!.x, 0) / idxs.length
    const uy = idxs.reduce((a, i) => a + cs[i]!.y, 0) / idxs.length
    let ty = uy - ((u.text.length) * 9)
    if (u.label) {
      parts.push(
        renderMultilineText(u.label, ux, ty, FONT_SIZES.nodeLabel,
          `text-anchor="middle" font-size="${FONT_SIZES.nodeLabel}" font-weight="700" fill="var(--_text)"`),
      )
      ty += 18
    }
    for (const t of u.text) {
      parts.push(
        `<text x="${ux}" y="${ty}" dy="0.35em" text-anchor="middle" font-size="${FONT_SIZES.edgeLabel}" ` +
        `font-weight="600" fill="var(--_text)">${esc(t.label)}</text>`,
      )
      ty += 18
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}

/**
 * Constraint-relaxation layout. Union pairs are pulled to a center distance
 * that produces the desired overlap; every other pair is kept apart so that
 * only declared unions intersect. Deterministic (fixed initial placement).
 */
function solveCenters(
  radii: number[],
  unionPairs: Map<string, number>,
  pairKey: (a: number, b: number) => string,
): Array<{ x: number; y: number }> {
  const n = radii.length
  if (n === 0) return []
  if (n === 1) return [{ x: 0, y: 0 }]

  const SEP = 16
  const spread = radii.reduce((a, b) => a + b, 0)
  const pos = radii.map((_, i) => {
    const ang = (i / n) * Math.PI * 2
    return { x: Math.cos(ang) * spread * 0.5, y: Math.sin(ang) * spread * 0.5 }
  })

  for (let it = 0; it < 400; it++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[j]!.x - pos[i]!.x
        const dy = pos[j]!.y - pos[i]!.y
        const dist = Math.hypot(dx, dy) || 0.01
        const ux = dx / dist, uy = dy / dist
        const overlap = unionPairs.get(pairKey(i, j))
        let target: number
        let twoSided: boolean
        if (overlap != null) { target = radii[i]! + radii[j]! - overlap; twoSided = true }
        else { target = radii[i]! + radii[j]! + SEP; twoSided = false }
        const diff = dist - target
        if (!twoSided && diff >= 0) continue // already separated
        const move = diff * 0.25 // damped, each endpoint moves half of that
        pos[i]!.x += ux * move; pos[i]!.y += uy * move
        pos[j]!.x -= ux * move; pos[j]!.y -= uy * move
      }
    }
  }
  return pos
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
