# Release Draft: 0.1.0-alpha.4

Status: draft

Version target: `0.1.0-alpha.4`

This draft is intended to become the GitHub release notes and npm publish summary for the next alpha cut.

## Summary

`0.1.0-alpha.4` turns the repository from a single core delegation proof point into a more usable plugin package for real intra-instance validation.

The release is centered on three outcomes:

- a channel-adapter layer now exists above the normalized managed A2A contract
- a Feishu reference adapter and shadow-profile validation flow make real cutover testing practical
- the repository now has a stronger open-source maintainer baseline for compatibility tracking and release operations

## Highlights

### 1. Channel Adapter SPI

This release adds a dedicated channel-adapter SPI so channel-native collaboration entrypoints can normalize into the canonical managed A2A contract without pushing routing rules into prompts.

Current reference coverage includes:

- adapter registration through the plugin entrypoint
- normalization hooks for channel-native parameters
- result and error compatibility mapping back to channel-facing payloads

### 2. Feishu Reference Adapter

The repository now ships a Feishu/domain reference adapter.

It can:

- resolve requester identity from registry-backed chat metadata
- resolve targets from agent id, chat id, or loose target hints
- classify local execute vs ask clarify vs delegate
- map normalized managed failures into channel-facing compatibility errors

This gives the plugin a concrete adapter reference while keeping the core managed A2A contract IM-agnostic.

### 3. Shadow Validation Flow

The release also adds a dedicated shadow-profile validation toolkit.

Key additions:

- `scripts/setup-shadow-profile.mjs`
- `scripts/verify-shadow-smoke.mjs`
- `scripts/verify-shadow-failures.mjs`
- `docs/shadow-profile.md`

This gives maintainers a repeatable path to validate:

- normal trusted intra-instance delegation through `runtime_subagent`
- degraded local execution through `cli_fallback`
- fail-closed behavior for unresolved targets, requester resolution failures, loop detection, and invalid timeout envelopes

### 4. Repository Operations Hardening

The repository now carries a more complete public-maintainer baseline:

- compatibility regression issue intake
- Dependabot for npm and GitHub Actions
- declarative label taxonomy with sync workflow
- GitHub metadata validation workflow
- release-note category configuration
- support and release rehearsal docs

These changes do not alter the managed A2A contract, but they make the repository substantially easier to maintain as a public plugin project.

## Compatibility Notes

- target OpenClaw range remains `>=2026.3.13 <2026.4.0`
- current example config is aligned to the config shape accepted by OpenClaw `2026.3.13`
- preferred trusted path remains `runtime_subagent`
- explicit degraded fallback remains local CLI dispatch

## Validation

Validated locally with:

```bash
npm run ci
npm run smoke:shadow:full
```

Expected release-facing interpretation:

- unit and repository validation pass
- package tarball includes docs, scripts, and plugin metadata
- positive and negative shadow validation both pass

## Suggested Release Notes Blurb

`0.1.0-alpha.4` adds the first channel-adapter layer to `openclaw-managed-a2a`, ships a Feishu reference adapter, and introduces an isolated shadow-profile validation workflow for trusted intra-instance deployments. It also hardens the repository for public maintenance with compatibility issue intake, label sync, release-note taxonomy, and release rehearsal docs.
