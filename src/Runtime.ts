import { Atom } from '@effect-atom/atom-react'
import * as ManagedRuntime from 'effect/ManagedRuntime'

import * as Layers from './Layers'

export const Runtime = ManagedRuntime.make(Layers.all)

export const defaultAtomRuntime = Atom.runtime(Layers.all)
