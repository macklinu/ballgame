---
name: macklinu-code-style
description: Apply my default code style for implementation and review through simple designs, focused APIs, explicit state models, contract-based non-tautological tests, idiomatic library use, focused documentation, and reviewable changes. Use whenever writing, changing, refactoring, testing, documenting, or reviewing code or dependencies, even when the user does not mention code style.
---

# macklinu Code Style

## Design

- Choose the simplest design that fully satisfies the current requirement.
- Add an abstraction only when repeated code or a real domain boundary justifies it. Do not create a helper, wrapper, union type, or configuration layer merely to hide one call.
- Delete code, comments, tests, and transitional paths when they no longer serve the current implementation.

## APIs and state

- Expose only the API required by the current product behavior. Do not add commands, extension points, or configuration for possible future needs.
- Use a named options object instead of positional arguments when a function takes more than one input.
- Add data fields only when they carry useful information. Construct an error with no fields without passing a placeholder `{}` argument.
- For user-visible state, define when it is created, updated, and cleared. Test the full validation sequence: show the error, edit the input, and recover to a valid state.
- When a value can be in one of a fixed set of mutually exclusive states, model it with a discriminated union or state machine. Avoid multiple booleans when their combinations can represent impossible states; independent conditions can remain booleans.

```ts
// Avoid: several combinations are contradictory or meaningless.
type RequestFlags = {
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
}

// Prefer: every value represents one valid state.
type RequestState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; value: T }
  | { status: "error"; error: Error }
```

## Tests

- Test observable behavior and state or resource transitions that are likely to fail.
- Do not write tautological tests that calculate expected results with the same logic as the implementation or merely confirm that a mock returns its configured value. Derive expectations independently from the observable contract, and choose cases that would fail for a plausible defect.
- Keep tests deterministic and focused. Do not test source-code structure, confirm that removed fields stay absent, exercise deliberate no-op stubs, or depend on incidental implementation details.
- Prefer the framework's test and lifecycle utilities to custom wrappers.
- When operation order or resources matter, make ownership and cleanup explicit in both the implementation and its tests.

## Libraries and validation

- Read primary documentation and relevant source code before changing an unfamiliar rule, parser, or configuration.
- Use a parser only when its accepted input matches the domain. If a general parser accepts or normalizes values that the domain forbids, retain explicit domain validation around it.
- Use the installed library's standard patterns for resources, errors, discriminated data, and cleanup.
- When library behavior is unclear, first check `repos/**` and `vendor/**` at the repository root for vendored source. Effect source is commonly available there.

## Documentation and dependencies

- Keep quick-start documentation focused on the user's task. Put branch or merge details and implementation rationale in contributor or design documentation instead.
- Preserve existing wording unless the change requires a user-visible documentation update.
- Clearly distinguish versions that were tested from version ranges that are supported. Do not require consumers to use an exact version unless a verified compatibility constraint makes it necessary.
- Explain exclusions and policy choices that could otherwise surprise reviewers or affect user decisions.

## Reviewability

- Keep each module focused on one responsibility. When an entry point mixes concerns, separate view rendering, runtime wiring, and domain logic into appropriate modules.
- When dependent changes are easier to review separately, use a small ordered stack of pull requests. Keep unrelated refactors out of the feature change.
