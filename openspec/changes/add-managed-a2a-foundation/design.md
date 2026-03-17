## Context
The project starts from a practical observation: native OpenClaw A2A is necessary but insufficient for managed domain-agent collaboration. The missing pieces are protocol semantics, policy enforcement, auditability, and compatibility-aware transport handling.

The current implementation ideas available from prior research include official primitives, internal compatibility shims, and CLI fallbacks. The product should not expose those transport details as its identity. It should preserve a stable collaboration contract while allowing the transport layer to evolve.

Unlike retrieval or context plugins, this project is not centered on ranking, embedding, or summarization algorithms. Its credibility should come from protocol and distributed-systems discipline:

- A2A-aligned task semantics
- idempotent delivery handling
- lease-bounded execution
- well-founded delegation graphs
- fail-closed policy enforcement

## Goals / Non-Goals
- Goals:
  - define managed A2A as a plugin-owned capability
  - define a structured delegation model that can be explained and defended independently of any one transport
  - separate protocol from transport
  - allow migration from internal shims to future official plugin gateway APIs
  - keep skills in a supporting, not authoritative, role
  - keep correctness-critical behavior deterministic
- Non-Goals:
  - replacing OpenClaw native A2A
  - locking the design to Feishu-specific routing assumptions
  - standardizing a workflow engine beyond collaboration transport and governance
  - making auxiliary models a mandatory dependency for core correctness

## Structured Delegation Model

The plugin should be framed as a structured delegation layer for long-running agents.

That model has five core invariants:

1. A2A-aligned task model
   - Collaboration is represented as explicit request and lifecycle state rather than ad hoc prompt exchange.
   - The external contract should stay conceptually compatible with official A2A task semantics where practical.

2. Idempotent at-least-once delivery
   - The system should not promise unrealistic exactly-once transport.
   - Instead, it should tolerate retries and reconnects through stable request identity and dedupe semantics.
   - The practical target is effectively-once behavior at the collaboration-contract layer.

3. Lease-bounded execution
   - `ttl_seconds` is treated as a lease or deadline, not an advisory hint.
   - Wait loops, fallback paths, and long-running transport behavior must remain bounded by this lease.

4. Well-founded delegation graph
   - `hop`, `ttl_seconds`, and `visited_agents` jointly constrain delegation.
   - The system should prevent collaboration loops, unbounded forwarding, and indefinite wait chains.

5. Fail-closed policy enforcement
   - Publish restrictions, scope checks, and capability gates must be enforced in plugin code.
   - If guarantees cannot be preserved, the system should reject or degrade explicitly instead of guessing.

## Value Hierarchy

The design should preserve a clear value hierarchy.

1. Core managed A2A value
   - Turn raw agent connectivity into governed delegation.
   - Preserve specialization, observability, and policy control across agent collaboration.

2. Single-turn value
   - Provide the simplest high-value collaboration unit with strong reliability properties.
   - Solve evidence requests, verification, and bounded internal execution without requiring thread machinery.

3. Multi-turn value
   - Add governed continuity for clarification, suspend/resume, and long-running collaborative threads.
   - Extend the single-turn core rather than replacing it.

## Trust Model and Quality Objective

The initial design target is not a generic low-trust A2A network.

It is a trusted intra-instance domain-agent system where:

- agents share an operational boundary
- trust assumptions are relatively strong
- prompts, tools, and knowledge boundaries are coordinated
- the main reason to collaborate is to improve complex-task quality

Under this model, value comes from two different quality mechanisms:

1. Single-turn expert delegation
   - The requester uses specialist domain context to improve execution quality on a bounded subtask.
   - This is primarily a context and specialization advantage.

2. Multi-turn quality-gated collaboration
   - The requester keeps the most authoritative view of user intent and can review delegate output across turns.
   - This is primarily an acceptance, correction, and convergence advantage.

## Boundary from Subagent Primitives

The design should clearly distinguish managed A2A from OpenClaw subagent/runtime primitives.

Subagent primitives are useful building blocks, but they solve a different problem:

- they are closer to local execution assistance
- they are often scoped to the caller's active runtime context
- they do not, by themselves, define a governed domain-agent collaboration contract

Managed A2A exists above that level:

- stable domain-agent identity matters
- specialist delegation quality matters
- audit and policy matter
- thread or turn semantics may matter in future extensions

## Single-Turn Core and Future Multi-Turn Extension

The current design should treat managed single-turn delegation as the minimal interoperable unit.

That means:

- one governed request
- one bounded execution lease
- one managed result or explicit failure outcome

Repeated collaboration can be modeled as multiple governed requests, but that is not yet the same thing as a first-class multi-turn collaboration thread.

### Why v1 Should Stay Single-Turn

Single-turn delegation is the right starting point because it keeps the hardest guarantees tractable:

- idempotency is easier to define
- audit boundaries are clearer
- TTL and timeout enforcement is simpler
- publish restrictions are easier to enforce
- transport fallback remains understandable

It also captures the first major quality win in the trusted domain-agent model:

- bounded specialist delegation improves execution quality before thread machinery is needed

If v1 jumps directly to multi-turn collaboration, the design must also solve:

- thread identity
- turn ordering
- session reuse or restoration
- clarification and suspend/resume semantics
- turn-level policy enforcement
- termination of ping-pong loops

### Future Multi-Turn Model

If multi-turn managed collaboration is added later, it should be modeled as a threaded extension above the single-turn core.

The extension should introduce explicit thread concepts such as:

- `collab_thread_id`
- `turn_id`
- `reply_to_turn_id`
- `thread_lease_seconds`
- `awaiting_party`

The thread model should support states such as:

- `active`
- `awaiting_input`
- `handed_off`
- `resumed`
- `completed`
- `aborted`
- `expired`

Each turn should still obey the structured delegation invariants:

- stable identity
- bounded execution
- explicit policy checks
- auditable lifecycle

In the trusted domain-agent setting, this future thread model should preserve a requester-side quality gate:

- the requester holds the top-level task context
- the delegate returns evidence, drafts, or unresolved questions
- the requester can accept, reject, refine, or reissue work based on the original user goal
- the thread should improve quality through controlled review loops rather than free-form chat

The requester-side gate should be modeled through a bounded action set, for example:

- `accept`
- `reject`
- `refine`
- `clarify`
- `reissue`
- `abort`

These actions matter because they turn review behavior into auditable protocol semantics:

- `accept` closes the thread successfully
- `reject` records explicit non-acceptance
- `refine` keeps work on the same bounded goal with correction
- `clarify` resolves ambiguity before further execution
- `reissue` starts a revised bounded turn under updated instructions
- `abort` terminates the thread intentionally

The default action-to-state model should be:

| Action | Default Thread Transition | Delegate Continuation Policy |
|---|---|---|
| `accept` | `completed` | stop current delegate |
| `reject` | `aborted` | stop current delegate |
| `refine` | `active` | same delegate continues |
| `clarify` | `awaiting_input` -> `resumed` | same delegate continues |
| `reissue` to same delegate | `active` | same delegate continues on a new bounded turn |
| `reissue` to different delegate | `handed_off` -> `active` | new delegate takes over |
| `abort` | `aborted` | stop current delegate |

These defaults are chosen to preserve three important distinctions:

1. correction versus replacement
   - `refine` corrects the same specialist's output
   - `reissue` can replace the executor if specialist fit has changed

2. ambiguity resolution versus substantive rework
   - `clarify` resolves uncertainty before more work
   - `refine` or `reissue` drive the next substantive output

3. explicit non-acceptance versus continued execution
   - `reject` is terminal by default
   - continued work should be represented explicitly through `refine` or `reissue`

### Reference Directions

The future multi-turn extension should be informed by three families of prior art:

1. A2A task and context semantics
   - A2A treats long-running work as a task with state, context continuity, history, streaming updates, and `input-required` interruption.
   - This is the best protocol-level reference for thread/task semantics.

2. AutoGen handoff and termination patterns
   - AutoGen swarm and graph patterns show how multi-agent handoff, shared context, and termination conditions can be expressed at runtime.
   - This is a useful runtime-level reference for turn routing and bounded multi-agent exchange.

3. LangGraph state graphs and checkpointing
   - LangGraph shows how long-running agent workflows can be modeled with explicit state, checkpointing, persistence, and controlled message history.
   - This is a useful systems-level reference for resume, durability, and thread memory boundaries.

## Decisions
- Decision: The plugin will own protocol and governance, not just transport wrappers.
  - Rationale: product value comes from policy, audit, and stable collaboration semantics.

- Decision: Transport must be adapter-based.
  - Rationale: current compatibility paths may depend on internal runtime details, while future OpenClaw versions may provide official plugin gateway dispatch APIs.

- Decision: Delivery semantics will target idempotent at-least-once handling instead of claiming exactly-once execution.
  - Rationale: it matches practical distributed-systems constraints while still giving operators predictable collaboration outcomes.

- Decision: Core correctness must be deterministic.
  - Rationale: routing and policy correctness should not depend on auxiliary model calls that can drift, fail, or add cost.

- Decision: Auxiliary models, if introduced later, are optimization-only.
  - Rationale: semantic routing, compression, clustering, or diagnostics ranking may help efficiency, but they must remain optional and outside the correctness path.

- Decision: v1 will center on single-turn managed delegation.
  - Rationale: this gives the cleanest base for idempotency, auditability, bounded execution, and compatibility handling.

- Decision: multi-turn collaboration, if introduced, will be thread-based rather than implicit repeated prompt exchange.
  - Rationale: explicit thread and turn semantics are necessary to preserve governance and observability once collaboration spans multiple exchanges.

- Decision: requester-side quality gates will use an explicit bounded action set.
  - Rationale: acceptance, rejection, correction, and reissue should become visible protocol semantics rather than implicit prompt behavior.

- Decision: requester gate actions will map to explicit default state transitions and delegate-continuation rules.
  - Rationale: this keeps correction, clarification, handoff, and termination behavior auditable and prevents free-form retry loops.

- Decision: managed A2A will be positioned as distinct from subagent orchestration.
  - Rationale: the product value is governed domain-agent delegation, not merely invoking another local runtime helper.

- Decision: the initial product target is trusted intra-instance domain-agent collaboration.
  - Rationale: that is the real deployment model in which governed delegation delivers immediate value through quality improvement.

- Decision: the primary product value is task quality improvement, not interoperability for its own sake.
  - Rationale: within a shared-trust OpenClaw deployment, the main benefit is better completion of complex work through specialization and quality gates.

- Decision: Skills are companion guidance only.
  - Rationale: prompt instructions are not a reliable enforcement path for auth, audit, or fail-closed policy.

- Decision: Prefer a core-plus-adapter package shape.
  - Rationale: it preserves generic value while allowing Feishu or future channel/domain integrations to remain outside the core.

## Risks / Trade-offs
- Risk: internal OpenClaw compatibility shims may break across upgrades.
  - Mitigation: isolate them in one adapter, add capability probes, and maintain fallback paths.

- Risk: overemphasizing A2A transport may blur the product position.
  - Mitigation: consistently describe the plugin as a managed collaboration layer above native A2A.

- Risk: channel-specific assumptions leak into core design.
  - Mitigation: define resolver and adapter interfaces early, before implementation expands.

- Risk: the design may drift into model-centric automation because that is fashionable in adjacent plugins.
  - Mitigation: explicitly separate correctness from optimization and make model-assisted features opt-in.

- Risk: retries or reconnects may create duplicate work or duplicated side effects.
  - Mitigation: treat request identity and idempotency as first-class protocol concepts from the start.

- Risk: multi-turn ambitions could overcomplicate the core before the base contract is stable.
  - Mitigation: keep v1 single-turn and design the multi-turn model as a backward-compatible extension.

## Migration Plan
1. Start with a stable protocol contract and transport abstraction.
2. Encode structured delegation invariants into protocol and lifecycle docs before implementation expands.
3. Support the best currently available adapter for the target OpenClaw version.
4. Add compatibility probes and fallback diagnostics before hardening channel adapters.
5. Define a future thread-based multi-turn model without making it a prerequisite for v1.
6. Migrate to official plugin gateway APIs once they are released and validated.

## Open Questions
- What should be the final package split between core and Feishu adapter repos?
- What is the minimum initial protocol surface for v0?
- Should the first public release include a CLI doctor, or treat it as v0.2 functionality?
- Should a future semantic router exist at all, or should routing remain deterministic in v1?
- Should future multi-turn collaboration use a central coordinator per thread or allow decentralized handoff within bounded rules?
