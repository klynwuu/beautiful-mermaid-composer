// GitHub — the familiar GitHub light + dark UI palette.
import type { ThemeDefinition } from './types.ts'
import { THEMES } from '../theme.ts'

const github: ThemeDefinition = {
  id: 'github',
  label: 'GitHub',
  font: 'Inter',
  light: THEMES['github-light']!,
  dark: THEMES['github-dark']!,
}

export default github
