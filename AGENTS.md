# Tooling

Run `oxlint` and `oxfmt` with `--disable-nested-config`. Do not allow nested tool configuration files to change repository linting or formatting behavior.

# Nub

Follow the project-scoped `.agents/skills/nub` skill. Use `nub install` for
dependencies, `nub run <script>` for package scripts, and `nubx <tool>` for
locally installed CLIs. Nub preserves this repository's text `bun.lock` in
compatibility mode.

For a clean checkout, run `nub install --frozen-lockfile`. The approved
dependency build scripts are recorded in `package.json#allowBuilds`; review
and approve any new request with `nub approve-builds <package>` before
committing the resulting manifest change. The root `prepare` script is
intentional and must run during normal setup.
