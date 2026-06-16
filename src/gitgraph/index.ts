import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS, estimateTextWidth } from '../styles.ts'

// ============================================================================
// Git graph (native)
//
// Mermaid `gitGraph` syntax:
//   gitGraph
//     commit
//     branch develop
//     commit id: "fix" tag: "v1"
//     checkout main
//     merge develop
//
// Rendered as horizontal branch lanes (LR) with commit dots in commit order,
// diagonal connectors for branch points, and curves for merges. Branch colors
// are shades of the theme accent so any future theme recolors the graph.
// ============================================================================

type CommitType = 'NORMAL' | 'REVERSE' | 'HIGHLIGHT' | 'MERGE'

interface Commit {
  id: string
  branch: string
  type: CommitType
  tag?: string
  seq: number
  parent?: Commit
  mergeParent?: Commit
}

const PAD = 28
const COMMIT_DX = 56
const LANE_DY = 70
const DOT_R = 7
const ACCENT = 'var(--accent, var(--_line))'

// Themeable branch palette — distinct shades of the brand accent.
const BRANCH_COLORS = [
  ACCENT,
  `color-mix(in srgb, ${ACCENT} 55%, var(--fg))`,
  `color-mix(in srgb, ${ACCENT} 50%, var(--bg))`,
  `color-mix(in srgb, ${ACCENT} 75%, var(--fg))`,
  `color-mix(in srgb, ${ACCENT} 35%, var(--bg))`,
  `color-mix(in srgb, ${ACCENT} 65%, var(--fg))`,
]
const branchColor = (lane: number) => BRANCH_COLORS[lane % BRANCH_COLORS.length]!

interface GitModel {
  commits: Commit[]
  laneOf: Map<string, number>
  orientation: 'LR' | 'TB'
}

function attr(line: string, key: string): string | undefined {
  // matches: key: "value" | key:"value" | key: VALUE
  const q = line.match(new RegExp(`${key}\\s*:\\s*"([^"]*)"`))
  if (q) return q[1]
  const w = line.match(new RegExp(`${key}\\s*:\\s*([^\\s]+)`))
  return w?.[1]
}

function parse(lines: string[]): GitModel {
  const header = lines[0] ?? ''
  const orientation: 'LR' | 'TB' = /\b(TB|BT)\b/.test(header) ? 'TB' : 'LR'
  const mainName = attr(header, 'mainBranchName') ?? 'main'

  const commits: Commit[] = []
  const laneOf = new Map<string, number>()
  const heads = new Map<string, Commit | undefined>()
  laneOf.set(mainName, 0)
  heads.set(mainName, undefined)
  let current = mainName
  let seq = 0
  let auto = 0

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!
    const cmd = line.split(/\s+/)[0]

    if (cmd === 'commit' || cmd === 'cherry-pick') {
      const id = attr(line, 'id') ?? `c${auto++}`
      const typeStr = (attr(line, 'type') ?? 'NORMAL').toUpperCase()
      const type = (['NORMAL', 'REVERSE', 'HIGHLIGHT'].includes(typeStr) ? typeStr : 'NORMAL') as CommitType
      const c: Commit = { id, branch: current, type, tag: attr(line, 'tag'), seq: seq++, parent: heads.get(current) }
      commits.push(c)
      heads.set(current, c)
      continue
    }

    if (cmd === 'branch') {
      const name = line.split(/\s+/)[1]
      if (name) {
        if (!laneOf.has(name)) laneOf.set(name, laneOf.size)
        heads.set(name, heads.get(current)) // branch point = current head
        current = name
      }
      continue
    }

    if (cmd === 'checkout' || cmd === 'switch') {
      const name = line.split(/\s+/)[1]
      if (name && laneOf.has(name)) current = name
      continue
    }

    if (cmd === 'merge') {
      const name = line.split(/\s+/)[1]
      if (name) {
        const c: Commit = {
          id: attr(line, 'id') ?? `merge-${name}`,
          branch: current,
          type: 'MERGE',
          tag: attr(line, 'tag'),
          seq: seq++,
          parent: heads.get(current),
          mergeParent: heads.get(name),
        }
        commits.push(c)
        heads.set(current, c)
      }
      continue
    }
  }

  return { commits, laneOf, orientation }
}

export function renderGitGraphSvg(
  lines: string[],
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const model = parse(lines)
  const lanes = model.laneOf.size

  // Coordinates (LR): x by commit seq, y by lane. TB swaps the two axes.
  const laneAxis = PAD + 20 // offset of lane 0
  const seqAxis = PAD + 30
  const pos = (c: Commit) => {
    const along = seqAxis + c.seq * COMMIT_DX
    const across = laneAxis + (model.laneOf.get(c.branch) ?? 0) * LANE_DY
    return model.orientation === 'TB' ? { x: across, y: along } : { x: along, y: across }
  }

  const maxSeq = model.commits.reduce((m, c) => Math.max(m, c.seq), 0)
  const alongMax = seqAxis + maxSeq * COMMIT_DX
  const acrossMax = laneAxis + (lanes - 1) * LANE_DY
  const width = (model.orientation === 'TB' ? acrossMax : alongMax) + PAD + 40
  const height = (model.orientation === 'TB' ? alongMax : acrossMax) + PAD + 30

  const parts: string[] = []
  parts.push(svgOpenTag(width, height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  // Branch rails: a full-width line per branch at its lane. Solid between the
  // branch's first and last commit (the commit path); dotted in the empty
  // regions (before the first commit, after the last) out to the diagram edges.
  const railStartEdge = seqAxis
  const railEnd = alongMax + 30
  const railSeg = (name: string, across: number, a0: number, a1: number, color: string, dashed: boolean) => {
    if (a1 - a0 < 0.5) return
    const p0 = model.orientation === 'TB' ? { x: across, y: a0 } : { x: a0, y: across }
    const p1 = model.orientation === 'TB' ? { x: across, y: a1 } : { x: a1, y: across }
    const dash = dashed ? ' stroke-dasharray="1 7" stroke-linecap="round"' : ' stroke-linecap="round"'
    parts.push(
      `<line class="git-branch-rail" data-branch="${esc(name)}" x1="${p0.x}" y1="${p0.y}" x2="${p1.x}" y2="${p1.y}" ` +
      `stroke="${color}" stroke-width="2.5"${dash} />`,
    )
  }
  for (const [name, lane] of model.laneOf) {
    const onBranch = model.commits.filter(c => c.branch === name)
    if (onBranch.length === 0) continue
    const minSeq = Math.min(...onBranch.map(c => c.seq))
    const maxSeqB = Math.max(...onBranch.map(c => c.seq))
    const solidStart = seqAxis + minSeq * COMMIT_DX
    const solidEnd = seqAxis + maxSeqB * COMMIT_DX
    const across = laneAxis + lane * LANE_DY
    const color = branchColor(lane)
    railSeg(name, across, railStartEdge, solidStart, color, true) // dotted lead-in
    railSeg(name, across, solidStart, solidEnd, color, false) // solid commit path
    railSeg(name, across, solidEnd, railEnd, color, true) // dotted tail
  }

  // Cross-lane connectors only (same-lane links are covered by the rails):
  //   branch points (parent on another lane) and merges.
  for (const c of model.commits) {
    const p = pos(c)
    const lane = model.laneOf.get(c.branch) ?? 0
    if (c.parent && (model.laneOf.get(c.parent.branch) ?? 0) !== lane) {
      parts.push(connector(pos(c.parent), p, branchColor(lane), model.orientation))
    }
    if (c.mergeParent) {
      parts.push(connector(pos(c.mergeParent), p, branchColor(model.laneOf.get(c.mergeParent.branch) ?? 0), model.orientation))
    }
  }

  // Commit dots + labels.
  for (const c of model.commits) {
    const p = pos(c)
    const color = branchColor(model.laneOf.get(c.branch) ?? 0)
    parts.push(commitGlyph(c, p, color))

    // Commit id label below the dot.
    parts.push(
      `<text x="${p.x}" y="${p.y + DOT_R + 13}" text-anchor="middle" ` +
      `font-size="${FONT_SIZES.edgeLabel - 1}" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-muted)">${esc(c.id)}</text>`,
    )

    // Tag above the dot (small pill).
    if (c.tag) {
      const tw = estimateTextWidth(c.tag, FONT_SIZES.edgeLabel - 1, 600) + 12
      const ty = p.y - DOT_R - 20
      parts.push(
        `<g class="git-tag">` +
        `\n  <rect x="${p.x - tw / 2}" y="${ty}" width="${tw}" height="16" rx="3" ry="3" ` +
        `fill="color-mix(in srgb, ${ACCENT} 22%, var(--bg))" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.innerBox}" />` +
        `\n  <text x="${p.x}" y="${ty + 8}" dy="0.35em" text-anchor="middle" font-size="${FONT_SIZES.edgeLabel - 1}" ` +
        `font-weight="600" fill="var(--_text)">${esc(c.tag)}</text>` +
        `\n</g>`,
      )
    }
  }

  // Branch name labels at the start of each lane.
  for (const [name, lane] of model.laneOf) {
    const color = branchColor(lane)
    const across = laneAxis + lane * LANE_DY
    const x = model.orientation === 'TB' ? across : PAD - 4
    const y = model.orientation === 'TB' ? PAD - 6 : across
    if (model.orientation === 'TB') {
      parts.push(
        `<text x="${x}" y="${y}" text-anchor="middle" font-size="${FONT_SIZES.edgeLabel}" font-weight="700" fill="${color}">${esc(name)}</text>`,
      )
    } else {
      parts.push(
        `<text x="${x}" y="${y}" dy="0.35em" text-anchor="start" font-size="${FONT_SIZES.edgeLabel}" font-weight="700" fill="${color}">${esc(name)}</text>`,
      )
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}

/** A connector between two commits: straight if colinear, else a smooth S-curve. */
function connector(
  a: { x: number; y: number },
  b: { x: number; y: number },
  color: string,
  orientation: 'LR' | 'TB',
): string {
  if (a.x === b.x || a.y === b.y) {
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${color}" stroke-width="2" fill="none" />`
  }
  // Smooth cubic easing across the lane change along the flow axis.
  const d = orientation === 'TB'
    ? `M ${a.x},${a.y} C ${a.x},${(a.y + b.y) / 2} ${b.x},${(a.y + b.y) / 2} ${b.x},${b.y}`
    : `M ${a.x},${a.y} C ${(a.x + b.x) / 2},${a.y} ${(a.x + b.x) / 2},${b.y} ${b.x},${b.y}`
  return `<path d="${d}" stroke="${color}" stroke-width="2" fill="none" />`
}

function commitGlyph(c: Commit, p: { x: number; y: number }, color: string): string {
  if (c.type === 'MERGE') {
    return (
      `<g class="git-commit" data-type="MERGE">` +
      `\n  <circle cx="${p.x}" cy="${p.y}" r="${DOT_R}" fill="var(--bg)" stroke="${color}" stroke-width="2.5" />` +
      `\n  <circle cx="${p.x}" cy="${p.y}" r="${DOT_R - 4}" fill="${color}" />` +
      `\n</g>`
    )
  }
  if (c.type === 'HIGHLIGHT') {
    const s = DOT_R + 2
    return (
      `<g class="git-commit" data-type="HIGHLIGHT">` +
      `\n  <rect x="${p.x - s}" y="${p.y - s}" width="${s * 2}" height="${s * 2}" rx="2" fill="${color}" stroke="var(--bg)" stroke-width="1.5" />` +
      `\n</g>`
    )
  }
  if (c.type === 'REVERSE') {
    return (
      `<g class="git-commit" data-type="REVERSE">` +
      `\n  <circle cx="${p.x}" cy="${p.y}" r="${DOT_R}" fill="${color}" stroke="var(--bg)" stroke-width="1.5" />` +
      `\n  <path d="M ${p.x - 3},${p.y - 3} L ${p.x + 3},${p.y + 3} M ${p.x + 3},${p.y - 3} L ${p.x - 3},${p.y + 3}" stroke="var(--bg)" stroke-width="1.4" />` +
      `\n</g>`
    )
  }
  return `<circle class="git-commit" data-type="NORMAL" cx="${p.x}" cy="${p.y}" r="${DOT_R}" fill="${color}" stroke="var(--bg)" stroke-width="1.5" />`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
