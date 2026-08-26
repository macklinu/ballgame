# Tooling

Run `oxlint` and `oxfmt` with `--disable-nested-config`. Do not allow nested tool configuration files to change repository linting or formatting behavior.

# Nub

Follow the project-scoped `.agents/skills/nub/SKILL.md`.

# Documentation

Keep documentation concise and scoped to the ticket. Record only reader-facing operational information; link to existing sources instead of adding implementation or recovery narrative.
Put recurring agent workflow instructions in this file.

# Delivery

GitHub issues define scope and dependencies; implement only the assigned unblocked issue. Work on a feature branch, open an atomic PR, and never push or merge `main`.

# Tests

Keep controlled fixtures typed; reserve `unknown` for intentionally untrusted boundary inputs. Use `toMatchObject` for selected plain public fields and exact assertions for Options, states, errors, and privacy boundaries.
