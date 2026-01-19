import { Atom } from '@effect-atom/atom-react'

export const teamsQuickSearchAtom = Atom.make<{ readonly isActive: boolean; filter: string }>({
  isActive: false,
  filter: '',
})

export const teamsQuickSearchFilterAtom = Atom.map(teamsQuickSearchAtom, ({ filter }) => filter)
