// Tokyo Night Storm — the softer, slightly-lighter-ground Tokyo Night variant.
import type { ThemeDefinition } from './types.ts'
import { THEMES } from '../theme.ts'

const tokyoNightStorm: ThemeDefinition = {
  id: 'tokyo-night-storm',
  label: 'Tokyo Night Storm',
  font: 'Inter',
  light: THEMES['tokyo-night-light']!,
  dark: THEMES['tokyo-night-storm']!,
}

export default tokyoNightStorm
