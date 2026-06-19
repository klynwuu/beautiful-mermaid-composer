// Dracula — the well-known dark palette. Dracula ships no official light
// variant, so both light/dark use the same (dark) colors.
import type { ThemeDefinition } from './types.ts'
import { THEMES } from '../theme.ts'

const dracula: ThemeDefinition = {
  id: 'dracula',
  label: 'Dracula',
  font: 'Inter',
  light: THEMES['dracula']!,
  dark: THEMES['dracula']!,
}

export default dracula
