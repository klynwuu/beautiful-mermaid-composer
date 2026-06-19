// Catppuccin — Latte (light) and Mocha (dark) from the pastel palette family.
import type { ThemeDefinition } from './types.ts'
import { THEMES } from '../theme.ts'

const catppuccin: ThemeDefinition = {
  id: 'catppuccin',
  label: 'Catppuccin',
  font: 'Inter',
  light: THEMES['catppuccin-latte']!,
  dark: THEMES['catppuccin-mocha']!,
}

export default catppuccin
