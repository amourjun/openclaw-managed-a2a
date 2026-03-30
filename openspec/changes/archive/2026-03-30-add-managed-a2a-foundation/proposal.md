## Why
OpenClaw native A2A/session primitives are the right foundation for cross-agent communication, but they are not, by themselves, a managed collaboration protocol.

What teams actually need for long-running domain agents is not only message delivery. They need a stable entrypoint, routing constraints, publish restrictions, auditability, timeout semantics, and compatibility-aware transport handling. These are policy and governance concerns layered above native A2A.

Skills alone are not a stable implementation vehicle for those guarantees. Skills can guide model behavior, but they cannot reliably own:

- transport auth and scope handling
- structured audit lifecycle
- compatibility probes and fallback policy
- fail-closed enforcement for publish restrictions and collaboration contract rules

Therefore the project should be positioned as an OpenClaw managed A2A plugin: an enhancement layer built on top of official native A2A/session primitives, not a replacement for them.

The value hierarchy should be explicit:

- the core product value is governed delegation between agents
- the v1 value unit is strong single-turn delegation
- a future value extension is governed multi-turn collaboration for clarification and long-running threads

The deployment assumption should also be explicit:

- the initial target is a trusted intra-instance domain-agent architecture
- the primary value is complex-task quality improvement under shared trust
- the primary goal is not generic low-trust cross-boundary agent interoperability

## What Changes
- Define the product as a managed A2A plugin for OpenClaw
- Establish plugin-owned responsibilities:
  - managed collaboration entrypoint
  - protocol contract and policy enforcement
  - transport adapter selection
  - audit trail and diagnostics
  - version compatibility and capability probing
- Establish skills-owned responsibilities:
  - teach agents when to collaborate
  - provide usage patterns and parameter guidance
  - explain fallback behavior to operators
- Define an adapter-first architecture so future official plugin gateway APIs can replace internal compatibility shims without changing the collaboration contract
- Define the theoretical and engineering foundation as a structured delegation model rather than a prompt-only or model-routed heuristic
- Define delivery semantics around:
  - idempotent request handling
  - lease-bounded execution
  - well-founded delegation graphs
  - fail-closed policy enforcement
- Define the boundary between correctness and optimization:
  - correctness-critical behavior stays deterministic in plugin code
  - model-assisted routing, compression, or clustering remain optional future optimizations
- Define the initial collaboration scope as managed single-turn delegation
- Define a future extension path for managed multi-turn collaboration using explicit thread/task semantics rather than ad hoc repeated prompts
- Define the trust and deployment model as trusted intra-instance domain-agent collaboration
- Define the product value model around task-quality improvement:
  - single-turn improves quality through specialist delegation
  - multi-turn improves quality through requester-side quality gates and correction loops
- Define the product boundary against OpenClaw subagent primitives so domain-agent managed A2A is not misread as subagent orchestration
- Define a likely package boundary:
  - core managed A2A plugin capability
  - domain/channel adapters such as Feishu-specific resolvers

## Non-Goals
- Do not replace OpenClaw native `sessions_send`, `sessions_spawn`, or subagent runtime primitives
- Do not build a general-purpose workflow engine or BPM system
- Do not encode Feishu-specific domain registry and routing assumptions into the generic core
- Do not define current internal gateway-call shims as permanent public product surface
- Do not treat companion skills as the sole enforcement layer for collaboration guarantees
- Do not treat v1 as a full multi-turn collaborative conversation runtime
- Do not commit this proposal to a specific implementation timeline or release plan

## Positioning
This plugin should be positioned as:

- a managed collaboration layer for OpenClaw
- an enhancement on top of native A2A/session primitives
- a policy-aware and auditable agent collaboration plugin for long-running domain-agent deployments

It should not be positioned as:

- a fork or replacement of OpenClaw A2A
- an entirely new multi-agent runtime
- a Feishu-only operations plugin

The main product message should be:

- OpenClaw gives you native A2A primitives
- this plugin turns those primitives into a governed collaboration capability
- its core is a structured delegation layer, not another agent workflow toy
- v1 starts with strong single-turn delegation rather than weakly-specified multi-turn chat
- its first home is trusted intra-instance domain-agent systems where better collaboration should improve task quality

## Impact
- Affected specs:
  - `managed-a2a-plugin`
- Expected follow-up work:
  - define protocol surface
  - define structured delegation invariants and delivery semantics
  - define the boundary between single-turn core and future threaded collaboration
  - define transport adapter interface
  - define capability probe and compatibility matrix
  - define core vs adapter package boundary
