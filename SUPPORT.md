# Support

This repository is still in an early public-maintainer stage.

Support is best-effort, not SLA-backed.

## Where to Go

Use the right path for the kind of problem you have:

- security issue: follow [`SECURITY.md`](./SECURITY.md)
- OpenClaw upgrade or adapter regression: use the Compatibility Regression issue form
- reproducible defect or operator-visible failure: use the Bug Report issue form
- new capability or architecture idea: use the Feature Request issue form and then OpenSpec if needed
- release or compatibility process questions: start with [`docs/compatibility.md`](./docs/compatibility.md), [`docs/publish-npm.md`](./docs/publish-npm.md), and [`docs/release-rehearsal.md`](./docs/release-rehearsal.md)

## What Makes Support Easier

When opening an issue, include:

- exact OpenClaw version
- plugin version or commit SHA
- install mode
- minimal reproduction steps
- exact command output or diagnostics excerpt

For compatibility issues, `npm run smoke:shadow:full` output is especially useful.

## What This Repository Does Not Promise

This repository does not currently promise:

- immediate maintainer response
- support for undocumented OpenClaw internals forever
- bespoke consulting for private deployments

The goal is to keep support actionable, reproducible, and tied to the managed-a2a contract.
