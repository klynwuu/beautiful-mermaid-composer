// ============================================================================
// Theme definition — the shape of one "styling file".
//
// A theme is a self-contained TS module under src/themes/ that default-exports
// a ThemeDefinition. The build (bm-editor.ts / bm-preview.ts) discovers every
// such file via a glob, so dropping a new file here makes the theme appear in
// the editor's dropdown (and its font in the font picker) with no other edits.
//
// Colors feed three consumers, so they stay plain DiagramColors:
//   - the official-mermaid engine (mapped to mermaid themeVariables),
//   - the retained custom renderers (venn / ishikawa / eventmodeling),
//   - the ASCII pipeline.
//
// `css` is the per-theme mermaid `themeCSS` override — the hook for shipping a
// distinct "look" by file. It is layered on top of the shared BASE_FINISH_CSS
// (see src/engine/finish.ts).
// ============================================================================

import type { DiagramColors } from '../theme.ts'

export type { DiagramColors }

export interface ThemeDefinition {
  /** Unique id (kebab-case) used internally and in the dropdown value. */
  id: string
  /** Human label shown in the editor dropdown. */
  label: string
  /** Recommended Google font for diagrams in this identity. */
  font: string
  /**
   * Sort weight in the dropdown (lower = earlier). Themes without an order sort
   * after ordered ones, alphabetically by label. Keeps hero brands on top.
   */
  order?: number
  /**
   * "Glass" identity: translucent surfaces meant to overlay a background image.
   * The editor renders a real per-node frosted backdrop blur for these.
   */
  glass?: boolean
  /** Light variant colors. */
  light: DiagramColors
  /** Dark variant colors. */
  dark: DiagramColors
  /**
   * Optional per-theme mermaid `themeCSS`, layered on BASE_FINISH_CSS. Use this
   * to ship a look that goes beyond the color roles (e.g. custom node radius,
   * dashes, label chips) without touching the engine.
   */
  css?: string
}

/**
 * The brand shape the editor frontend consumes via `window.__mermaid.BRANDS`.
 * It is exactly ThemeDefinition minus the engine-only `css` field, kept as a
 * distinct type so the frontend contract is unchanged by the refactor.
 */
export interface BrandTheme {
  id: string
  label: string
  font: string
  glass?: boolean
  light: DiagramColors
  dark: DiagramColors
}
