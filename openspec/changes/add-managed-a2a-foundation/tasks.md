## 1. Scope
- [x] 1.1 Freeze product positioning and naming for repo, package, plugin id, and display name
- [x] 1.2 Define which guarantees belong to plugin code vs companion skills
- [x] 1.3 Define the first supported OpenClaw version range and upgrade policy
- [x] 1.4 Define the trust model and quality objective for the initial deployment target

## 2. Architecture
- [x] 2.1 Define the managed collaboration protocol surface
- [x] 2.2 Define the transport adapter interface and fallback order
- [x] 2.3 Define capability probes and degraded-mode diagnostics
- [x] 2.4 Define the split between core package and Feishu/domain adapters
- [x] 2.5 Define structured delegation invariants and delivery semantics
- [x] 2.6 Define the boundary between deterministic correctness and optional model-assisted optimization
- [x] 2.7 Define the boundary between v1 single-turn delegation and future thread-based multi-turn collaboration

## 3. Planning Output
- [x] 3.1 Add a design document for protocol, transport, and compatibility boundaries
- [x] 3.2 Add initial README positioning and installation narrative
- [x] 3.3 Add a compatibility checklist for future OpenClaw upgrades
- [x] 3.4 Add protocol and compatibility reference docs for external readers
- [x] 3.5 Add a future multi-turn collaboration design note and vocabulary
- [x] 3.6 Add value-model documentation for single-turn and multi-turn collaboration
- [x] 3.7 Add a v1 implementation-slice document for the first OSS release

## 4. V1 Implementation Slice
- [x] 4.1 Freeze the v1 cut line: core-only, trusted intra-instance, single-turn only
- [x] 4.2 Freeze the request, response, status, and error types
- [x] 4.3 Implement deterministic policy validation for the single-turn envelope
- [x] 4.4 Implement the transport adapter interface and selector
- [x] 4.5 Implement the primary adapter for currently supported OpenClaw versions
- [x] 4.6 Implement the explicit CLI fallback adapter
- [x] 4.7 Implement capability probes and degraded-path diagnostics
- [x] 4.8 Implement minimal audit lifecycle records
- [x] 4.9 Add focused unit and integration-style verification for happy and degraded paths

Current implementation status:
- The repository now contains the initial OSS skeleton, core protocol/types, config resolution, deterministic request validation, adapter selection, capability probing, runtime-subagent execution, explicit CLI fallback execution, audit persistence, and focused verification for happy and degraded paths.
- Remaining work is now about hardening and packaging rather than missing the core v1 execution slice.
