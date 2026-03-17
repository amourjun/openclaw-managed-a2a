# Project Context

## Purpose
Provide a production-ready OpenClaw plugin for managed agent-to-agent collaboration.

The project focuses on adding a policy-aware, auditable, compatibility-conscious collaboration layer on top of OpenClaw native session, subagent, and A2A primitives. It is not intended to replace OpenClaw core orchestration. It is intended to make long-running domain agents collaborate reliably under explicit protocol and governance rules.

## Tech Stack
- TypeScript (ESM), Node.js runtime
- OpenClaw plugin SDK
- TypeBox and/or Zod for config and tool schemas
- Vitest for focused unit and integration tests
- OpenSpec for proposal-first change management

## Project Conventions

### Code Style
- Keep changes small, explicit, and reversible.
- Prefer ASCII-only source unless the file already requires Unicode.
- Favor descriptive names over framework shorthand.
- Default new behavior to opt-in or capability-gated when compatibility risk exists.
- Keep OpenClaw-internal compatibility shims isolated in one adapter module.

### Architecture Patterns
- Official OpenClaw API surfaces are always preferred over internal runtime shims.
- Separate protocol from transport:
  - Protocol layer owns request contract, policy, audit semantics, and error normalization.
  - Transport adapters own delivery details and OpenClaw compatibility handling.
- Skills are companion guidance only:
  - hard guarantees belong in plugin code
  - prompt files MUST NOT be the only enforcement path for collaboration policy
- Prefer a core-plus-adapter package shape:
  - `managed-a2a-core` for protocol and transport
  - channel/domain adapters for Feishu or future integrations

### Testing Strategy
- Run `openspec validate <change-id> --strict` for every change.
- Add focused Vitest coverage for protocol, adapter selection, and fallback behavior.
- Add explicit capability probes for supported OpenClaw versions.
- Manually verify one happy path and one degraded path whenever transport integration changes.

### Git Workflow
- Use OpenSpec proposals before implementation for new capabilities, architecture changes, and compatibility-sensitive work.
- Keep changes grouped by capability, not by incidental file touch.
- Do not treat experimental local shims as stable public contract without a proposal and compatibility notes.

## Domain Context
- OpenClaw already provides native A2A/session primitives such as `sessions_send`, `sessions_spawn`, and gateway/subagent runtime capabilities.
- This project exists above those primitives and adds managed collaboration semantics:
  - request identity
  - hop and TTL controls
  - visited-agent tracking
  - publish restrictions such as evidence-only and no external announce
  - auditable collaboration lifecycle records
- The plugin must remain useful even if OpenClaw later improves native A2A transport, async delivery, queueing, or plugin runtime gateway APIs.

## Important Constraints
- Do not position this project as a replacement multi-agent framework.
- Do not rely on prompt-only skills for transport correctness, auth, audit, or policy enforcement.
- Treat OpenClaw internal gateway-call shims as temporary compatibility layers, not product identity.
- Maintain a clear upgrade path from internal shims to future official plugin-to-gateway APIs.
- Prefer fail-closed behavior with actionable diagnostics over silent degraded behavior when policy guarantees cannot be preserved.

## External Dependencies
- OpenClaw runtime, gateway, session, and plugin subsystems
- GitHub for repository hosting and release distribution
- Optional OpenClaw internal runtime entrypoints until official plugin gateway dispatch APIs are published
