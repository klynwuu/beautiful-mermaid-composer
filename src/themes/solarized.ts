// Solarized — Ethan Schoonover's precision light + dark palette.
import type { ThemeDefinition } from './types.ts'
import { THEMES } from '../theme.ts'

const solarized: ThemeDefinition = {
  id: 'solarized',
  label: 'Solarized',
  font: 'Inter',
  light: THEMES['solarized-light']!,
  dark: THEMES['solarized-dark']!,
}

export default solarized
