import { useAtom } from '@effect/atom-react'
import * as Array from 'effect/Array'
import * as Data from 'effect/Data'
import * as Equal from 'effect/Equal'
import * as Option from 'effect/Option'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { useCallback } from 'react'

export type View = Data.TaggedEnum<{
  Schedule: {}
  GameDetails: Readonly<{ gamePk: number }>
}>
export const View = Data.taggedEnum<View>()

const viewsAtom = Atom.make<ReadonlyArray<View>>([View.Schedule()])

export const useCurrentView = () => {
  const [views, setViews] = useAtom(viewsAtom)

  const pushView = useCallback(
    (view: View) => {
      setViews((views) =>
        Array.last(views).pipe(
          Option.filter((lastView) => !Equal.equals(lastView, view)),
          Option.map(() => Array.append(views, view)),
          Option.getOrElse(() => views),
        ),
      )
    },
    [setViews],
  )

  const popView = useCallback(() => {
    setViews((views) => (views.length > 1 ? views.slice(0, views.length - 1) : views))
  }, [setViews])

  return {
    currentView: Array.last(views).pipe(Option.getOrThrow),
    isNestedView: views.length > 1,
    pushView,
    popView,
  }
}
