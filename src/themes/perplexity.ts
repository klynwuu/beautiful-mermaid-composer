// Perplexity (2026) brand identity. Colors live in THEMES (src/theme.ts) as the
// single source of truth — also consumed by the library + preview — and are
// referenced here so they never drift.
import type { ThemeDefinition } from './types.ts'
import { THEMES } from '../theme.ts'

const perplexity: ThemeDefinition = {
  id: 'perplexity',
  label: 'Perplexity',
  font: 'Space Grotesk',
  light: THEMES['perplexity']!,
  dark: THEMES['perplexity-dark']!,
}

export default perplexity
