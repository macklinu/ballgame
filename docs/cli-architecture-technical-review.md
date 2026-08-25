# CLI architecture technical review

- Reviewed: 2026-08-23
- Status: technical implementation context. [Foundation decisions](foundation-decisions.md)
  is the current planning authority; this review supplies the OpenTUI/React/
  Effect guidance for implementing it.
- Scope: Ballgame's OpenTUI React shell, dialogs, commands, Effect Atom, runtime ownership, and current OpenTUI tooling.

## Decision summary

- **Keymap is required.** Use the first-party `@opentui/keymap` package as Ballgame's command architecture.
- Do not restore `@opentui-ui/dialog` or `@opentui-ui/toast`. Their latest releases peer with OpenTUI `0.1.x`, while
  Ballgame is on OpenTUI `0.5.x`.
- Build a small application-owned overlay host from ordinary OpenTUI boxes. OpenTUI does not ship a first-party dialog
  component.
- Keep command dispatch, UI state transitions, and business effects separate. Keymap resolves input; Atom actions
  apply UI workflows; Effect services perform domain and provider work.
- This review documents direction only. It does not authorize implementation work beyond this document.

## Current architecture

| Area       | Current state                                                                                           | Assessment                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Rendering  | `src/index.tsx` creates the renderer and renders one large `App` component.                             | Good starting point, but the root component owns too many unrelated concerns.                                           |
| Navigation | `src/View.ts` holds a tagged stack of `Schedule` and `GameDetails` views.                               | A sound seed for typed navigation. It should become the route model rather than being supplemented by ad hoc booleans.  |
| Commands   | One root `useKeyboard` listener handles every key, conditional on local state.                          | The main architectural constraint. Commands are active outside their screen and cannot be independently tested.         |
| Dialogs    | Go To Date is an absolute box controlled by `isGoToDateOpen`.                                           | It has no typed overlay model, stack, focus/priority policy, or reusable command boundary.                              |
| UI state   | Date and selection are atoms; view state and dialog state are split across atoms and React local state. | Use Atom for cross-cutting state and workflows; retain local state for simple transient form drafts.                    |
| Data       | Schedule and game feed are atom families backed by separate Atom runtimes.                              | React components get reactive data, but there is no single app composition root.                                        |
| Services   | Schedule and game APIs are Effect services.                                                             | Correct direction, but the current surface exposes MLB identifiers, transport errors, and an unknown game-feed payload. |
| Runtime    | `src/Runtime.ts` and `src/Layers.ts` are not consumed by the UI's atom runtimes.                        | Consolidate runtime and provider selection before further data work.                                                    |
| Refresh    | The schedule atom has an Effect schedule and `App` also creates a React interval.                       | Duplicate ownership; this will not meet the intended retain-last-successful-data behavior.                              |
| Tests      | One TODO-style property test exists.                                                                    | No command-scope, overlay, or rendered interaction coverage exists yet.                                                 |

## Key findings

### Global keyboard handling conflicts with screen ownership

`useKeyboard` in `src/index.tsx` currently dispatches schedule selection, navigation, dialog control, and quit from one
global handler. For example, schedule arrow keys remain enabled in the game-detail view even though the product
decision says selection is a schedule-screen action. Enter may also attempt to access a selected game when the
successful schedule contains no games.

OpenTUI documents direct keyboard listeners as suitable for a small application-wide shortcut set. They run before the
focused renderable. The project needs layered, contextual behavior instead.

### The former dialog dependency is not a viable migration target

Before the OpenTUI `0.5` upgrade, Ballgame used `@opentui-ui/dialog` and `@opentui-ui/toast`. The available dialog
release is `0.1.2` and peers with `@opentui/core` and `@opentui/react` `^0.1.69`; it was correctly removed during the
upgrade. It should not be reintroduced through forced or ignored peer dependencies.

OpenTUI `0.5` does not offer a built-in dialog element. A dialog should therefore be an application component with an
explicit state model, not a replacement dependency hunt.

### Atom and runtime ownership are fragmented

`dateAtom`, selection, and view state are global atoms, while the schedule and game feed create independent
`Atom.runtime(...)` instances in `src/index.tsx`. `src/Runtime.ts` already declares a default Atom runtime, but it is
unused. This makes a full fixture-versus-live provider selection, injected tests, and lifecycle ownership harder than
they need to be.

### Data state is not yet the normalized MLB boundary

The UI still accepts numeric MLB `gamePk` values; `GameApi.feed` returns an MLB-shaped `GameFeedLive` with `liveData`
typed as `Unknown`; service failures expose HTTP and schema errors directly. That is a useful spike, but not the
application-owned game reference, normalized domain model, and typed
application-error boundary described in the product vision.

### Refresh and shutdown need one visible owner

The schedule atom already polls through `Stream.fromEffectSchedule`, but `App` also calls `setInterval` to refresh it.
Polling, error retention, and timestamps should be an Effect-owned resource, not a combination of a stream and a
React timer. The `q` binding calls `process.exit(0)`, which can bypass renderer cleanup and terminal restoration;
shutdown should destroy the renderer through its owner instead.

## Target command architecture

```text
terminal event
  -> Keymap resolves the highest active layer
  -> named UI command
  -> Atom action/workflow
  -> state change and/or Effect service operation
  -> React renders screen, overlay, and active-command hints
```

Keymap is the input adapter, not a domain command bus. Its command handlers should be small adapters that invoke
named Atom actions or renderer lifecycle methods. Atom actions own state transitions and validation. Effect services
own typed domain operations and external effects.

### Command layers

| Layer               | Examples                                                                                        | Rule                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| App                 | Quit, open help                                                                                 | Lowest priority; always-present behavior only.                                   |
| Schedule screen     | Previous/next/today, Go To Date, selection, open game, open MLB.TV, board/command-center switch | Mounted only by the appropriate schedule route.                                  |
| Game-details screen | Back, detail-specific commands                                                                  | Must not inherit schedule-selection bindings.                                    |
| Top overlay         | Cancel, submit, confirm                                                                         | Higher priority than the underlying screen; Escape closes the top overlay first. |
| Focused widget      | Text editing, selection movement                                                                | Let OpenTUI's input/select components retain their native behavior.              |

This gives the intended Escape behavior without a long conditional chain: an open overlay owns Escape; otherwise the
detail screen owns it; the schedule screen does not. It also permits the footer and the `?` help overlay to query the
same active command metadata instead of maintaining a second, manually synchronized shortcut list.

## Dialog and overlay design

Represent overlays with a tagged union and a stack, even if the first release only opens one at a time:

```ts
type Overlay = Data.TaggedEnum<{
  GoToDate: {}
  Help: {}
}>
```

`OverlayHost` is rendered last in the app shell. It uses a full-screen, absolutely positioned box and a centered panel
with an explicit high `zIndex`. Each mounted overlay registers a high-priority Keymap layer, so it is the sole owner
of its cancel/submit behavior. Its input can be marked focused when mounted; closing it returns the user to the
screen's existing selected-game state.

Use React local state for a small raw input draft such as the Go To Date text field. Submit that draft to an Atom
action that validates and changes the selected date. Use a scoped Atom only when an overlay becomes a reusable,
multi-component state owner. Do not create a generic promise-based dialog manager until product requirements make one
necessary.

## Effect Atom and service boundaries

Use a `RegistryProvider` at the app root so one UI tree owns its Atom registry and tests can receive isolated state.
Create one application Atom runtime from the selected provider layer:

```text
React app
  -> RegistryProvider
  -> KeymapProvider
  -> app-owned Atom runtime
       -> normalized ScheduleService and GameService
            -> Mlb.layer
```

Production uses the MLB layer. Test harnesses inject derived fixture services;
fixtures are not a user-selectable runtime provider.

Keep state small and identity-based:

- `selectedDateAtom`
- `navigationAtom` containing typed routes
- `overlayStackAtom`
- selection by `ScheduleOccurrence` (selected date plus `GameRef`), not array index
- `scheduleForDateAtom(date)` and `gameDetailsAtom(gameRef)` for resources

Use `Atom.fnSync` for synchronous transitions such as changing selected game or closing an overlay. Use `Atom.fn` for
operations that validate data or interact with Effect services. Public service methods remain `Effect.fn` operations.

The polling representation should preserve the last successful value and time on failure. A snapshot can contain
`data`, `lastSuccessfulAt`, and `lastFailure`; an Effect stream or scoped worker owns retry timing. React must not add a
second interval.

## OpenTUI capabilities relevant now

Ballgame began using OpenTUI at `0.1.70` in January 2026 and now pins `0.5.6`. As of this review, `0.5.7` is available.
The notable newer capability for this app is the first-party `@opentui/keymap` package, first published in April 2026.
It provides layered bindings, named commands, focus-aware local layers, command queries, sequences, React hooks, and a
renderer-independent testing harness.

Useful, but not currently required, capabilities include React-aware in-memory rendering tests, keyboard and mouse
simulation, manual clocks, plugin slots, clipboard support, and animation. Do not introduce plugins, custom
renderables, or a generic modal framework merely because they exist.

## Ordered next steps

1. Update `@opentui/core` and `@opentui/react` to `0.5.7`, add `@opentui/keymap` at the same version, and perform a
   terminal smoke check. Keep the Effect v4 packages pinned to their matching `4.0.0-rc.111` release.
2. Create the app shell: `RegistryProvider`, one Keymap instance created alongside the renderer, and `KeymapProvider`.
3. Extract typed navigation, overlay stack, selected-game identity, and Atom actions from `src/index.tsx` without
   changing product behavior.
4. Implement `OverlayHost` and migrate only Go To Date and Help. This is the proof slice for overlay priority,
   generated discoverability, and validation failures.
5. Move schedule and detail bindings into their respective mounted components.
   Add only the daily board route in v0; command-center work is deferred.
6. Consolidate Atom runtime and MLB adapter selection; normalize the data
   contracts before building the box score.
7. Replace duplicate polling with one Effect-owned refresh model that retains last successful data and timestamps.
8. Replace direct process exit with renderer-owned shutdown and scoped cleanup.
9. Add three test layers: pure Atom action tests, Keymap precedence tests using `@opentui/keymap/testing`, and
   OpenTUI React rendered interaction tests.

## Deferred implementation choices

The command-center selection model is deferred with that feature. The remaining
overlay reachability, help presentation, overlay-stack, application-reference,
error-taxonomy, and retained-snapshot details are implementation choices for
the scoped foundation milestone; they must not reopen the settled product or
release decisions.

## References

- [OpenTUI Keymap overview](https://opentui.com/docs/keymap/overview/)
- [OpenTUI Keymap React integration](https://opentui.com/docs/keymap/react/)
- [OpenTUI keyboard input and propagation](https://opentui.com/docs/core-concepts/keyboard/)
- [OpenTUI testing](https://opentui.com/docs/core-concepts/testing/)
- [OpenTUI lifecycle and cleanup](https://opentui.com/docs/core-concepts/lifecycle/)
- [OpenTUI component availability](https://opentui.com/docs/components/overview/)
- `docs/product-vision.md`
