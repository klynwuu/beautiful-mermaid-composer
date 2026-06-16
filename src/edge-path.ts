import type { Point } from './types.ts'

// ============================================================================
// Shared connector path builders
//
// Used by the flowchart and class-diagram renderers so both produce identical
// "sharp" (orthogonal polyline) and "curved" (rounded-corner) connector styles.
// ============================================================================

/** Largest corner radius (px) used when smoothing connector bends. */
export const CURVE_RADIUS = 16

/** Build a plain polyline points string ("x,y x,y ..."). */
export function pointsToPolylinePath(points: Point[]): string {
  return points.map(p => `${p.x},${p.y}`).join(' ')
}

/**
 * Build a smooth SVG path for the flowing "curved" connector style (à la
 * draw.io). Each routed bend point is rounded with a quadratic arc whose radius
 * is capped to half the shorter adjacent segment, so corners never overshoot or
 * self-intersect — even where several edges converge on one node. Straight runs
 * stay straight, and the final approach is a line segment so arrow heads remain
 * correctly oriented along the connector.
 */
export function pointsToCurvedPath(points: Point[]): string {
  // Collapse consecutive duplicate points to avoid zero-length segments.
  const p: Point[] = []
  for (const pt of points) {
    const last = p[p.length - 1]
    if (!last || last.x !== pt.x || last.y !== pt.y) p.push(pt)
  }
  const n = p.length
  if (n < 3) {
    return `M ${round(p[0]!.x)},${round(p[0]!.y)} L ${round(p[n - 1]!.x)},${round(p[n - 1]!.y)}`
  }

  let d = `M ${round(p[0]!.x)},${round(p[0]!.y)}`
  for (let i = 1; i < n - 1; i++) {
    const prev = p[i - 1]!
    const cur = p[i]!
    const next = p[i + 1]!
    const len1 = Math.hypot(cur.x - prev.x, cur.y - prev.y)
    const len2 = Math.hypot(next.x - cur.x, next.y - cur.y)
    const r = Math.min(CURVE_RADIUS, len1 / 2, len2 / 2)
    // Pull back from the corner along the incoming segment, arc through the
    // corner, then resume along the outgoing segment.
    const ex = cur.x - ((cur.x - prev.x) / len1) * r
    const ey = cur.y - ((cur.y - prev.y) / len1) * r
    const sx = cur.x + ((next.x - cur.x) / len2) * r
    const sy = cur.y + ((next.y - cur.y) / len2) * r
    d += ` L ${round(ex)},${round(ey)} Q ${round(cur.x)},${round(cur.y)} ${round(sx)},${round(sy)}`
  }
  d += ` L ${round(p[n - 1]!.x)},${round(p[n - 1]!.y)}`
  return d
}

/** Trim sub-pixel noise from generated path coordinates. */
export function round(v: number): number {
  return Math.round(v * 100) / 100
}
