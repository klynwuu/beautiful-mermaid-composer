// Zinc — the neutral mono default (shadcn/zinc palette).
import type { ThemeDefinition } from './types.ts'
import { THEMES } from '../theme.ts'

const zinc: ThemeDefinition = {
  id: 'zinc',
  label: 'Zinc',
  font: 'Inter',
  light: THEMES['zinc-light']!,
  dark: THEMES['zinc-dark']!,
}

export default zinc
