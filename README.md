# openclaw-managed-a2a

Managed A2A plugin for OpenClaw: a policy-aware, auditable, compatibility-conscious collaboration layer built on top of native A2A, session, and subagent primitives.

## Status

This repository is in foundation stage.

- Product positioning and architecture are defined first through OpenSpec.
- The first milestone is a stable managed collaboration contract plus transport adapters.
- No production release is published yet.

## Current State

The repository now includes a working v1 execution slice for trusted intra-instance single-turn delegation:

- `runtime_subagent` as the preferred adapter
- explicit local CLI fallback
- normalized result and error payloads
- persisted audit traces
- focused unit and execution-path tests

What is still missing is hardening and packaging work, not the core execution path itself.

## Quick Start

### 1. Install Dependencies

```bash
npm ci
```

### 2. Validate the Repository

```bash
npm run ci
```

This runs:

- `npm run typecheck`
- `npm test`
- `npm pack --dry-run`
- `openspec validate --all --strict`

### 3. Load the Plugin in OpenClaw

Use the example config as a starting point:

- [`examples/openclaw.managed-a2a.jsonc`](./examples/openclaw.managed-a2a.jsonc)

Then restart the OpenClaw gateway.

### 4. Run a Real Smoke Test

Follow:

- [`docs/smoke-test.md`](./docs/smoke-test.md)

## Why This Exists

OpenClaw already gives you the right low-level primitives for agent-to-agent communication. For real long-running domain-agent deployments, that is necessary but not sufficient.

Teams usually need more than message delivery:

- a stable collaboration entrypoint
- policy enforcement for routing and publishing
- TTL, hop, and visited-agent controls
- auditable lifecycle records
- compatibility-aware transport selection and fallback

This project exists to turn native OpenClaw A2A into a governed collaboration capability.

## Trust Model

This project is currently optimized for a trusted intra-instance deployment model:

- agents run inside one OpenClaw instance or one tightly-governed runtime boundary
- participating domain agents are operated under shared trust and shared operational control
- core knowledge and tool boundaries are coordinated rather than adversarial
- the main problem is not "can two unknown agents interoperate"
- the main problem is "how can specialized agents collaborate to finish complex tasks better"

That means this project is not primarily designed around low-trust cross-organization A2A concerns such as external capability negotiation or weakly trusted peer discovery.

## Value Model

### Core Value of Managed A2A

The core value is not "more agents talking." It is governed delegation between long-running agents.

That means:

- specialists can collaborate without collapsing into one oversized generalist agent
- collaboration becomes observable, auditable, and policy-bounded
- operators get a stable internal collaboration contract instead of prompt-level conventions
- transport changes or runtime upgrades do not redefine the product contract
- complex tasks can be split across specialized agents without losing governance

### Quality Objective in Trusted Domain-Agent Systems

In this deployment model, the first-order value is task quality improvement.

Why:

- one agent session has limited practical context budget
- different domain agents carry different prompt, memory, tool, and review context
- complex requests benefit from specialist execution instead of one agent doing every subtask inside one overloaded session

So managed A2A is valuable not because it creates interop for its own sake, but because it helps a trusted domain-agent system complete hard tasks better.

### Value of Single-Turn Delegation

Single-turn managed delegation is the highest-leverage starting point because it gives strong value with the lowest coordination complexity.

It is especially valuable for:

- evidence requests
- one-shot verification
- bounded internal execution
- policy-sensitive internal routing
- reliable fallback and diagnostics

Its main advantage is that it keeps the hardest guarantees tractable:

- clearer idempotency
- clearer audit boundaries
- lower latency and lower token cost
- simpler timeout and lease control
- simpler compatibility handling

### Value of Future Multi-Turn Collaboration

Multi-turn collaboration adds value when one request and one answer are not enough.

It becomes valuable for:

- clarification loops
- requester follow-up within the same governed collaboration
- suspend and resume flows
- long-running task threads
- bounded multi-step internal coordination

Its main value is continuity:

- the collaboration stays inside one governed thread
- turn history and waiting state become explicit
- clarification does not degrade into ad hoc repeated prompting
- long-running work can remain auditable across turns

### Single-Turn vs Multi-Turn Value

| Dimension | Single-Turn Expert Delegation | Multi-Turn Quality-Gated Collaboration |
|---|---|---|
| Primary value | Improve task quality through specialist execution | Improve task quality through review, correction, and convergence |
| Best fit | One-shot evidence, verification, bounded subtask execution | Ambiguous, iterative, or high-stakes tasks needing clarification and revision |
| Context advantage | Delegate gets domain-specific prompt, memory, and tool context | Top-level agent keeps authoritative user intent across multiple review rounds |
| Main mechanism | Requester sends a bounded subtask to a specialist | Requester evaluates returned results and iterates under the original task context |
| Governance role | Strong bounded delegation contract | Strong thread-level acceptance and quality gate |
| Complexity | Lower | Higher |
| v1 status | Core path | Future extension |

## Subagent vs Managed A2A

This distinction should be explicit because people often confuse them.

| Dimension | OpenClaw Subagent | Single-Turn Managed A2A | Multi-Turn Managed A2A |
|---|---|---|---|
| Primary role | Local runtime helper inside the current task flow | Governed one-shot delegation to a domain specialist | Governed threaded collaboration with review and convergence |
| Deployment assumption | Usually tied to one active session or runtime context | Trusted intra-instance domain-agent system | Same trusted domain-agent system, but with explicit thread continuity |
| Identity | Often ephemeral and task-scoped | Stable domain-agent identity matters | Stable domain-agent identity plus thread and turn identity matter |
| Main value | Offload a local step or assist current execution | Improve complex-task quality through specialist execution | Improve complex-task quality through quality gates, correction, and iterative convergence |
| Context advantage | Reuses the caller's current runtime context | Delegate uses its own domain prompt, memory, tools, and review context | Requester keeps authoritative task intent while delegate contributes specialist output across turns |
| Governance need | Lighter-weight runtime coordination | Explicit policy, audit, TTL, hop, publish contract | All single-turn governance plus thread state, turn control, and requester-side acceptance gate |
| Best fit | Local helper behavior inside one execution context | Evidence requests, verification, bounded specialist subtasks | Ambiguous or high-stakes tasks needing clarification, review, and refinement |
| Threading value | Usually subordinate to the caller's execution | Not required for the core path | Core extension value |

In short:

- subagent is closer to a runtime execution primitive
- single-turn managed A2A is closer to governed expert delegation
- multi-turn managed A2A is closer to governed quality-gated collaboration

## From Native A2A to Managed Collaboration

Native primitives are the foundation. This plugin is the management layer above them.

More specifically, it is intended to become a structured delegation layer for long-running agents: idempotent at the collaboration layer, lease-bounded in execution, and fail-closed on policy enforcement.

| Area | OpenClaw Native Capability | Managed A2A Enhancement |
|---|---|---|
| Delivery primitives | `sessions_send`, `sessions_spawn`, subagent/runtime capabilities | Stable managed collaboration entrypoint built on top of those primitives |
| Request contract | Caller-defined and tool-specific | Explicit collaboration protocol with request identity and normalized semantics |
| Policy enforcement | Mostly left to caller logic or prompts | Plugin-owned routing, publish, and collaboration policy enforcement |
| Multi-hop control | No shared managed contract by default | TTL, hop count, visited-agent tracking |
| Auditability | Depends on caller implementation | Structured lifecycle records and operator diagnostics |
| Compatibility | Depends on current runtime surface | Capability probes, adapter selection, fallback, fail-closed behavior |
| Skills role | Skills can guide usage | Skills remain guidance only; hard guarantees stay in plugin code |

## What This Plugin Is

- An enhancement layer on top of native OpenClaw A2A/session primitives
- A managed collaboration protocol with explicit request contract and governance rules
- A transport-adapter architecture that can evolve as OpenClaw exposes better public APIs

## What This Plugin Is Not

- Not a replacement for OpenClaw core A2A
- Not a separate multi-agent runtime
- Not a Feishu-only orchestration plugin
- Not a prompt-only collaboration pattern

## Architecture At A Glance

```text
OpenClaw native primitives
  ├─ sessions_send / sessions_spawn
  ├─ subagent runtime
  └─ gateway/runtime surfaces
           │
           ▼
managed collaboration protocol
  ├─ request contract
  ├─ policy enforcement
  ├─ error normalization
  └─ audit lifecycle
           │
           ▼
transport adapters
  ├─ official adapter      (preferred when available)
  ├─ runtime_subagent      (current v1 practical path)
  └─ CLI fallback adapter  (degraded but explicit)
           │
           ▼
channel/domain adapters
  └─ Feishu and future resolvers
```

## Initial Scope

- Managed collaboration entrypoint
- Protocol contract and error normalization
- Transport adapter boundary
- Capability probes and version-compatibility checks
- Structured audit and operator diagnostics

## Initial Use Cases

- Domain agent asks another domain agent for internal evidence and receives governed, auditable results
- Collaboration requests must respect publish restrictions such as evidence-only or no external announce
- Operator needs explicit diagnostics when an OpenClaw upgrade breaks a transport path
- Channel-specific routing such as Feishu domain resolution stays outside the generic core
- Complex tasks improve because a requester can hand a bounded specialist subtask to a domain agent with better local context

## Design Principles

- Prefer official OpenClaw APIs over internal runtime shims
- Model collaboration as structured delegation, not prompt-only cooperation
- Separate protocol from transport
- Keep hard guarantees in plugin code, not in prompts alone
- Keep correctness deterministic; model-assisted features, if any, stay optional
- Fail closed when policy guarantees cannot be preserved
- Keep Feishu or other channel assumptions out of the generic core

## Roadmap

### v0.1 Foundation

- Managed collaboration protocol
- Initial transport abstraction
- Runtime-subagent adapter plus explicit fallback path
- Audit and diagnostics baseline

### v0.2 Hardening

- Capability probes and version matrix
- Doctor or self-check tooling
- Better degraded-path diagnostics

### v0.3 Adapters

- Cleaner official adapter path if OpenClaw exposes stable public plugin-to-gateway APIs
- Channel/domain adapters and examples

### Future Extension

- Thread-based managed multi-turn collaboration built on top of the single-turn core
- Requester-driven quality gates and correction loops across a governed collaboration thread

## Documentation

- [Managed A2A protocol](./docs/protocol.md)
- [Compatibility model](./docs/compatibility.md)
- [Managed multi-turn collaboration](./docs/multi-turn.md)
- [V1 implementation slice](./docs/v1-implementation-slice.md)
- [Smoke test guide](./docs/smoke-test.md)
- [Release checklist](./docs/release-checklist.md)
- [Publish to npm](./docs/publish-npm.md)

## OpenSpec

This repository uses OpenSpec for proposal-first development on capability and architecture changes.

Current foundation proposal:

- `openspec/changes/add-managed-a2a-foundation/`

Workflow:

1. Create or update a proposal in `openspec/changes/` for new features, architecture work, or compatibility-sensitive changes.
2. Validate the proposal with `openspec validate <change-id> --strict`.
3. Implement only after the proposal is reviewed.

Small fixes such as typo corrections, documentation polish, or non-breaking repository maintenance can be changed directly.

## Development

Requirements:

- Node.js 20+
- npm
- `openspec` CLI

Example setup:

```bash
npm install -g @fission-ai/openspec
openspec list
openspec validate --all --strict
```

## Repository Layout

```text
openspec/
  changes/      Proposed changes and architecture decisions
  specs/        Current accepted capability specs
```

As implementation is added, runtime code, tests, and adapter packages will be introduced under the same repository.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution rules, proposal workflow, and review expectations.

## Security

See [SECURITY.md](./SECURITY.md) for vulnerability reporting guidance.
