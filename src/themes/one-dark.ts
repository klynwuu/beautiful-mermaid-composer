// One Dark — Atom's signature dark palette. Dark-only here, so both light/dark
// use the same colors.
import type { ThemeDefinition } from './types.ts'
import { THEMES } from '../theme.ts'

const oneDark: ThemeDefinition = {
  id: 'one-dark',
  label: 'One Dark',
  font: 'Inter',
  light: THEMES['one-dark']!,
  dark: THEMES['one-dark']!,
}

export default oneDark
