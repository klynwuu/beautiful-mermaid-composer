// ============================================================================
// Theme registry — the single source the editor frontend and engine consume.
//
// THEME_DEFS comes from _registry.generated.ts (rebuilt from the theme files in
// this directory by generate.ts). This module derives the frontend-facing
// BRANDS list + brandColors() (the unchanged window.__mermaid contract) and the
// engine-facing themeCss() lookup.
// ============================================================================

import { THEME_DEFS } from './_registry.generated.ts'
import type { BrandTheme, ThemeDefinition } from './types.ts'
import type { DiagramColors } from '../theme.ts'

export type { BrandTheme, ThemeDefinition } from './types.ts'

/** Full theme definitions (includes engine-only `css`). */
export const THEME_DEFINITIONS: ThemeDefinition[] = THEME_DEFS

/** Frontend-facing brand registry — ThemeDefinition minus the `css` field. */
export const BRANDS: BrandTheme[] = THEME_DEFS.map(({ css, ...brand }) => brand)

/** Look up a brand + variant. Returns its DiagramColors, or null. */
export function brandColors(id: string, variant: 'light' | 'dark'): DiagramColors | null {
  const b = THEME_DEFS.find((x) => x.id === id)
  return b ? b[variant] : null
}

/** The per-theme mermaid themeCSS override for a brand id ('' if none). */
export function themeCss(id: string): string {
  return THEME_DEFS.find((x) => x.id === id)?.css ?? ''
}
