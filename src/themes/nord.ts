// Nord — the arctic, north-bluish palette (light + dark).
import type { ThemeDefinition } from './types.ts'
import { THEMES } from '../theme.ts'

const nord: ThemeDefinition = {
  id: 'nord',
  label: 'Nord',
  font: 'Inter',
  light: THEMES['nord-light']!,
  dark: THEMES['nord']!,
}

export default nord
