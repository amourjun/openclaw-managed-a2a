# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0-alpha.4

### Added

- add a channel-adapter SPI above the canonical managed A2A request contract
- add a Feishu reference adapter that resolves channel-native inputs into governed managed delegation
- add a core execution module so adapter logic and transport execution are separated more clearly
- add isolated shadow-profile setup and end-to-end smoke scripts for positive and negative validation
- add repository maintainer assets including compatibility issue intake, declarative label sync, release-note categorization, support guidance, and release rehearsal docs

### Changed

- register managed-a2a tools as optional and expose channel-adapter tools through the plugin entrypoint
- extend plugin config and manifest schema for channel adapters, especially the Feishu adapter block
- update the example OpenClaw config to match the config shape accepted by OpenClaw `2026.3.13`
- expand README and maintainer docs around compatibility review, release flow, and repository operations
- improve GitHub workflow hygiene with metadata validation, workflow concurrency, and repository-maintenance guidance

### Fixed

- preserve `target_agent_id` in Feishu compatibility failures even when rejection happens after adapter normalization
- prevent shadow smoke validation from tripping over session lock collisions by using isolated session ids
- ensure packaged tarballs include the validation scripts and tracked docs even when global gitignore rules would otherwise hide them

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
