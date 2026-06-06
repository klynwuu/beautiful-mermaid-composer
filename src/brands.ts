// ============================================================================
// Brand theme registry
//
// A "brand" is a complete visual identity: a light + dark color set plus a
// recommended diagram font. The Perplexity editor builds its theme dropdown
// from this registry, so adding a brand here makes it instantly selectable.
//
// ── To add a new brand identity ─────────────────────────────────────────────
// Copy the TEMPLATE below, fill in colors from the brand's guidelines, and push
// it onto BRANDS. It appears in the editor dropdown as "<label> · Light" and
// "<label> · Dark", and its font is added to the font picker automatically.
//
//   const ACME: BrandTheme = {
//     id: 'acme',                    // unique, kebab-case
//     label: 'Acme',                 // shown in the dropdown
//     font: 'Inter',                 // a Google font (loaded automatically)
//     light: {
//       bg: '#FFFFFF', fg: '#111111',
//       line: '#…', accent: '#…', muted: '#…', surface: '#…', border: '#…',
//     },
//     dark: {
//       bg: '#0B0B0B', fg: '#FAFAFA',
//       line: '#…', accent: '#…', muted: '#…', surface: '#…', border: '#…',
//     },
//   }
//   // …then add ACME to the BRANDS array.
//
// Color roles: bg=background, fg=primary text, line=connectors, accent=arrow
// heads/highlights, muted=secondary text & labels, surface=node fill,
// border=node stroke. Only bg + fg are required; the rest fall back to
// color-mix() derivations (see theme.ts).
// ============================================================================

import type { DiagramColors } from './theme.ts'
import { THEMES } from './theme.ts'

export interface BrandTheme {
  /** Unique id (kebab-case) used internally. */
  id: string
  /** Human label shown in the editor dropdown. */
  label: string
  /** Recommended Google font for diagrams in this identity. */
  font: string
  /** Light variant colors. */
  light: DiagramColors
  /** Dark variant colors. */
  dark: DiagramColors
}

// Perplexity (2026). Colors live in THEMES (single source of truth, also used
// by the library + preview); referenced here so they never drift.
const PERPLEXITY: BrandTheme = {
  id: 'perplexity',
  label: 'Perplexity',
  font: 'Space Grotesk',
  light: THEMES['perplexity']!,
  dark: THEMES['perplexity-dark']!,
}

export const BRANDS: BrandTheme[] = [
  PERPLEXITY,
  // ← add new BrandTheme objects here (see TEMPLATE above)
]

/** Look up a brand + variant. Returns its DiagramColors, or null. */
export function brandColors(id: string, variant: 'light' | 'dark'): DiagramColors | null {
  const b = BRANDS.find((x) => x.id === id)
  return b ? b[variant] : null
}
