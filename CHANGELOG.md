# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0-alpha.3

Unreleased follow-up after `0.1.0-alpha.2`.

## 0.1.0-alpha.2

Unreleased follow-up after `0.1.0-alpha.1`.

- add npm publish workflow for manual dispatch and release-driven publishing
- add npm publishing guide
- ensure repository-level `.gitignore` re-includes tracked docs even when a global ignore excludes `docs/`
- track the core reference docs in git

## 0.1.0-alpha.1

Initial alpha release of the repository foundation and v1 execution slice.

- define the managed A2A positioning, protocol, compatibility model, and v1 scope through OpenSpec
- implement the `managed_a2a_delegate` tool with deterministic request validation
- add `runtime_subagent` as the preferred trusted intra-instance transport
- add explicit local CLI fallback with normalized degraded-path handling
- persist minimal audit traces for accepted and executed collaboration requests
- add focused tests for policy validation, adapter selection, execution paths, and plugin registration
- add repository CI, smoke-test guidance, example config, and release checklist
