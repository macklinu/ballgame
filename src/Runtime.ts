import * as Atom from 'effect/unstable/reactivity/Atom'

import * as Layers from './Layers'

/** The only Effect Atom runtime used by the interactive application. */
export const appAtomRuntime = Atom.runtime(Layers.appLayer)
