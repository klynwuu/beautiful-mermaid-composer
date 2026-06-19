// Transparent Perplexity (2026) — "glass" overlay identity. Translucent frosted
// nodes designed to sit on top of a background image so the photo reads through
// the diagram. See the THEMES entries (src/theme.ts) for the color rationale.
import type { ThemeDefinition } from './types.ts'
import { THEMES } from '../theme.ts'

const transparentPerplexity: ThemeDefinition = {
  id: 'transparent-perplexity',
  label: 'Transparent Perplexity',
  font: 'Space Grotesk',
  order: 1,
  glass: true,
  light: THEMES['transparent-perplexity']!,
  dark: THEMES['transparent-perplexity-dark']!,
}

export default transparentPerplexity
