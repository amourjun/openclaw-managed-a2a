# V1 Implementation Slice

## Goal

Ship the smallest useful open-source version of `openclaw-managed-a2a` for trusted intra-instance domain-agent collaboration.

The v1 slice should prove one thing well:

- a governed single-turn delegation can be executed, diagnosed, and reasoned about without relying on prompt-only conventions

## V1 Cut Line

V1 should stop at:

- core plugin capability only
- trusted intra-instance deployment only
- single-turn managed delegation only
- deterministic correctness only
- minimal but credible transport compatibility handling

If a feature materially depends on thread semantics, planner logic, graph scheduling, or model-assisted routing, it should stay out of v1.

## In Scope

### Core Contract

- request validation for a single-turn managed delegation envelope
- normalized response and error model
- bounded execution semantics for TTL and timeout handling
- publish-contract and basic policy checks in deterministic code

### Transport Layer

- transport adapter interface
- adapter selection logic
- one practical primary adapter for current OpenClaw versions
- one explicit fallback adapter
- capability probes that explain why an adapter is or is not eligible

### Diagnostics and Audit

- structured lifecycle events for accepted, dispatched, completed, failed, expired, degraded
- normalized diagnostics for compatibility failures, policy denials, and transport failures
- enough local audit output to explain what happened during one governed request

### OSS Delivery Surface

- readable README and reference docs
- one example config or integration note
- focused unit tests around schema, adapter selection, and error normalization
- one happy-path integration-style verification path
- one degraded-path verification path

## Out of Scope

- multi-turn threads
- requester gate-action execution
- fan-out or parallel multi-agent dispatch
- graph-based orchestration
- semantic routing or model-assisted optimization
- Feishu-specific domain registry in core
- UI, dashboard, or visualization layer
- full doctor CLI beyond minimal capability checks

## Suggested Package Shape

```text
src/
  index.ts
  config/
  protocol/
  policy/
  adapters/
  probes/
  audit/
  errors/
  utils/
tests/
  unit/
  integration/
examples/
```

The first public slice should favor a single package with clear folders over premature multi-package splitting.

## V1 Deliverables

### 1. Plugin Skeleton

- plugin entrypoint
- config schema
- registration of the managed delegation capability

### 2. Protocol Types

- request envelope type
- response envelope type
- lifecycle status enum
- normalized error categories

### 3. Policy Checks

- required field validation
- TTL and timeout bounds
- hop and visited-agent sanity checks
- publish-contract validation

### 4. Adapter Layer

- `TransportAdapter` interface
- adapter selector
- `RuntimeSubagentAdapter` as the current practical public adapter
- `CliFallbackAdapter`

### 5. Capability Probes

- can preferred adapter be loaded
- can fallback adapter be loaded
- what failed and why

### 6. Audit and Diagnostics

- request accepted record
- adapter selected record
- outcome record
- structured diagnostic payload

### 7. Verification

- request schema unit tests
- policy edge-case tests
- adapter-selection tests
- one integration-style happy path
- one degraded-path compatibility or fallback test

## Acceptance Criteria

V1 is successful when all of the following are true:

1. The plugin loads with valid configuration.
2. A single-turn delegation request can be validated and normalized.
3. The runtime can select a supported adapter or fail closed with actionable diagnostics.
4. A happy-path governed request completes end-to-end in a trusted intra-instance setup.
5. A degraded or unsupported path reports the right normalized failure category.
6. The result is auditable enough that an operator can explain what happened.

## Default Build Order

1. Freeze plugin-facing names and config shape.
2. Implement protocol and error types.
3. Implement policy validation.
4. Implement adapter interface and selector.
5. Implement current primary adapter.
6. Implement CLI fallback.
7. Add probes, diagnostics, and audit events.
8. Add tests and one example integration path.

## Practical Non-Goals for V1

Do not expand v1 to solve these:

- "How do we coordinate many agents at once?"
- "How do we route semantically across a large agent graph?"
- "How do we keep a long-lived collaboration thread?"
- "How do we build a universal A2A protocol for low-trust environments?"

Those are valid future directions, but they are not the proof point this first release needs.
