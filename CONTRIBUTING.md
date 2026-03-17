# Contributing

## Before You Start

This project is intended to stay narrow and explicit:

- managed collaboration on top of OpenClaw native primitives
- protocol and governance in plugin code
- transport details isolated behind adapters

If your change introduces a new capability, changes architecture, affects compatibility, or changes security behavior, start with OpenSpec before writing code.

## Contribution Flow

1. Open an issue for bugs, gaps, or ideas if one does not already exist.
2. For feature work or architecture changes, create or update an OpenSpec proposal under `openspec/changes/`.
3. Run validation locally before opening a pull request.
4. Keep pull requests small and scoped to one capability or repository concern.

## OpenSpec Rules

Create a proposal when the change:

- adds or changes product capability
- changes the collaboration contract
- changes transport adapter behavior
- changes version-compatibility handling
- changes security or audit behavior

Direct changes are acceptable for:

- typo and formatting fixes
- README and template cleanup
- non-breaking repository maintenance
- tests that cover already-approved behavior

## Local Validation

Run the following before opening a pull request:

```bash
npm run ci
```

This covers:

- `npm run typecheck`
- `npm test`
- `npm pack --dry-run`
- `openspec validate --all --strict`

If your change needs environment-specific verification beyond that, include the extra commands and results in the pull request.

## Pull Request Expectations

Every pull request should explain:

- what changed
- why the change is needed
- which proposal or issue it relates to
- what validation was run
- whether OpenClaw compatibility or transport behavior is affected

## Design Expectations

- Prefer official OpenClaw APIs over internal runtime shims.
- If an internal compatibility shim is unavoidable, isolate it behind an adapter.
- Do not move hard collaboration guarantees into prompts or skills alone.
- Favor fail-closed behavior with actionable diagnostics.

## Review Scope

Review prioritizes:

- correctness of collaboration semantics
- safety of compatibility handling
- auditability and operator diagnostics
- clarity of product positioning
- reversibility of the change
