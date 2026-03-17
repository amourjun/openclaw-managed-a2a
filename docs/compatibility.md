# Compatibility Model

## Status

This document describes the intended compatibility strategy for `openclaw-managed-a2a`.

- It is a design-time compatibility model, not yet a release promise.
- The goal is to keep the managed collaboration contract stable while transport implementations evolve.

## Compatibility Philosophy

The plugin should depend on the most stable OpenClaw surface available in this order:

1. Official public plugin/runtime APIs
2. Isolated compatibility shims for internal runtime surfaces
3. Explicit degraded fallback paths such as CLI-based dispatch

The project should never present an internal shim as the product itself.

The project should also keep correctness deterministic:

- compatibility and policy gates stay in code
- auxiliary models are never required for core transport correctness
- optional model-assisted features, if any, must degrade cleanly

## Adapter Model

| Adapter | Role | Expected Status | Main Risk |
|---|---|---|---|
| `OfficialGatewayAdapter` | Uses stable public plugin-to-gateway APIs when OpenClaw exposes them | Preferred long-term path | Public API may not exist yet |
| `RuntimeSubagentAdapter` | Uses public `api.runtime.subagent.*` APIs for trusted intra-instance dispatch | Preferred v1 path | Availability can vary by runtime context or request scope |
| `CliFallbackAdapter` | Uses explicit subprocess-based fallback for degraded delivery | Safety net only | Latency, process management, weaker ergonomics |

## What Must Stay Stable

The following should remain stable across adapter changes:

- collaboration request contract
- policy semantics
- audit lifecycle meanings
- normalized error categories
- operator-facing diagnostics intent
- structured delegation invariants

The following are allowed to change between releases if clearly documented:

- concrete adapter implementation
- capability probe details
- internal runtime hook usage
- fallback ordering

## Risk Register

| Risk Area | Why It Matters | Expected Mitigation |
|---|---|---|
| Runtime subagent availability changes | Public runtime dispatch may be unavailable in some contexts or evolve across releases | Probe runtime availability and keep explicit CLI fallback |
| Gateway close or handshake behavior changes | Managed dispatch can fail before target session becomes usable | Detect early, classify as transport or compatibility failure, and expose diagnostics |
| Session lifecycle behavior changes | Spawn/send/wait semantics may shift across versions | Probe capability assumptions and keep async waiting outside fragile paths |
| Scope or auth behavior changes | Collaboration may fail even if transport is reachable | Separate policy denial from transport failure and report missing scope directly |
| CLI behavior changes | Fallback can break if command output or flags change | Keep fallback minimal and cover it with explicit tests |
| Schema validation changes | Config or tool params may start failing at load time | Maintain versioned schemas and preflight validation |

## Capability Probes

Each supported release line should probe the runtime before enabling a risky adapter.

Recommended probe areas:

| Probe | Why |
|---|---|
| Public plugin dispatch available | Prefer official surface if available |
| Runtime subagent callable | Validate whether the preferred public adapter is eligible in the current runtime |
| Session send/spawn semantics usable | Confirm native primitives behave as expected |
| Async wait path supported | Avoid depending on unsupported wait behavior |
| Scope requirements satisfied | Distinguish auth denial from transport outage |
| Config schema accepted | Fail fast on incompatible plugin configuration |
| Structured diagnostics obtainable | Ensure operator-visible failures stay actionable |

If a future release adds model-assisted optimizations, those should be probed separately and must not block core collaboration when unavailable.

## Release Compatibility Matrix

Once the first release exists, each release should publish a matrix like this:

| Plugin Version | OpenClaw Version Range | Preferred Adapter | Supported Fallback | Notes |
|---|---|---|---|---|
| `0.x.y` | `TBD` | `TBD` | `TBD` | Initial public matrix not published yet |

Until then, compatibility should be described as:

- contract-first
- adapter-dependent
- capability-probed
- fail-closed when guarantees cannot be preserved

## Upgrade Checklist for New OpenClaw Releases

When OpenClaw ships a new release, the plugin should verify at least these points:

1. Plugin loading and config schema still succeed.
2. Managed entrypoint registration still succeeds.
3. Preferred adapter capability probes still pass.
4. Internal shim behavior has not changed silently, if a shim is still used.
5. A happy-path collaboration completes end-to-end.
6. A degraded or unsupported path produces the correct normalized diagnostics.
7. Policy denials are still distinguishable from transport failures.
8. Audit records still capture request identity, target, outcome, and key diagnostics.

## Operator Guidance

The plugin should surface compatibility problems as explicit guidance, for example:

- no supported transport adapter available
- current OpenClaw version failed capability probe
- missing required scope for managed dispatch
- configured fallback path unavailable

Operator guidance should prefer concrete next actions over generic stack traces.

## Non-Goals

This compatibility model does not promise:

- indefinite support for undocumented OpenClaw internals
- zero-latency fallback behavior
- transparent automatic recovery from every runtime break

Instead, it aims to provide:

- clear adapter boundaries
- explicit downgrade behavior
- actionable upgrade diagnostics
