// Tokyo Night — popular dark editor theme (with its light counterpart).
import type { ThemeDefinition } from './types.ts'
import { THEMES } from '../theme.ts'

const tokyoNight: ThemeDefinition = {
  id: 'tokyo-night',
  label: 'Tokyo Night',
  font: 'Inter',
  light: THEMES['tokyo-night-light']!,
  dark: THEMES['tokyo-night']!,
}

export default tokyoNight
