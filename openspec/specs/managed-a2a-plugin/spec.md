# managed-a2a-plugin Specification

## Purpose
Define the stable, plugin-owned managed A2A collaboration contract for trusted intra-instance domain-agent delegation, including deterministic policy enforcement, transport compatibility behavior, and auditable lifecycle outcomes.
## Requirements
### Requirement: Managed A2A MUST Be a Plugin-Owned Collaboration Layer

The system SHALL implement managed collaboration as a plugin-owned capability layered above OpenClaw native A2A/session primitives.

#### Scenario: Agent needs governed collaboration
- **WHEN** an agent needs another agent to provide evidence, verification, or delegated internal work
- **THEN** the system MUST enter collaboration through a managed plugin entrypoint
- **AND** that entrypoint MUST preserve protocol semantics, policy enforcement, and structured lifecycle reporting

### Requirement: Hard Collaboration Guarantees MUST NOT Depend Solely on Skills

The system SHALL use plugin code, not prompt-only skills, as the authoritative enforcement path for transport correctness, auditability, and policy constraints.

#### Scenario: Companion skills are unavailable or overridden
- **WHEN** companion skills are missing, overridden, or ignored by the model
- **THEN** collaboration policy guarantees MUST continue to be enforced by plugin runtime logic
- **AND** operator-visible behavior MUST remain governed and auditable

### Requirement: Managed A2A Transport MUST Be Adapter-Based

The system SHALL isolate OpenClaw integration details behind an adapter boundary so the managed collaboration contract remains stable as official APIs evolve.

#### Scenario: Official plugin gateway dispatch becomes available
- **WHEN** OpenClaw exposes a stable public plugin runtime API for gateway dispatch
- **THEN** the system MUST allow that official adapter to replace temporary compatibility shims
- **AND** the external collaboration contract MUST remain unchanged

#### Scenario: Current compatibility path becomes unsupported
- **WHEN** the installed OpenClaw version no longer supports the active compatibility adapter
- **THEN** the system MUST either degrade through an explicit supported fallback path or fail closed with actionable diagnostics
- **AND** the failure MUST be attributable to adapter compatibility rather than being misreported as a protocol failure

### Requirement: Managed A2A MUST Implement Structured Delegation Semantics

The system SHALL model collaboration as structured delegation with bounded execution and well-founded forwarding rules.

#### Scenario: Multi-hop collaboration remains bounded
- **WHEN** a collaboration request is forwarded across agents
- **THEN** the system MUST advance bounded delegation controls such as `hop`, `ttl_seconds`, and `visited_agents`
- **AND** the system MUST prevent loops or indefinite forwarding chains

#### Scenario: Collaboration lease expires
- **WHEN** a collaboration request exceeds its allowed execution lease
- **THEN** the system MUST terminate or reject further managed handling
- **AND** the outcome MUST be reported as an explicit timeout or expiry state rather than an ambiguous transport result

### Requirement: Managed A2A Core MUST Optimize for Trusted Intra-Instance Domain-Agent Deployments

The system SHALL treat trusted intra-instance domain-agent collaboration as the initial optimization target for the core contract.

#### Scenario: Collaboration occurs within one governed deployment
- **WHEN** collaborating agents operate within one OpenClaw instance or one shared operational boundary
- **THEN** the system MUST optimize the core path for governed internal delegation under shared trust
- **AND** the system MUST NOT require low-trust cross-boundary negotiation semantics for the core value path

### Requirement: Managed A2A MUST Remain Distinct from Subagent Runtime Primitives

The system SHALL define managed A2A as a governed domain-agent collaboration layer rather than as a synonym for subagent orchestration.

#### Scenario: Reader compares subagent and domain-agent delegation
- **WHEN** the system is described alongside OpenClaw subagent or runtime helper capabilities
- **THEN** the documentation and product boundary MUST distinguish managed A2A from local subagent execution primitives
- **AND** the distinction MUST preserve the managed A2A focus on stable agent identity, policy, audit, and delegation quality

### Requirement: Managed A2A Delivery MUST Be Idempotent At the Collaboration Layer

The system SHALL use stable request identity so retries, reconnects, or duplicate submissions do not silently create uncontrolled duplicate collaboration effects.

#### Scenario: Caller retries the same collaboration request
- **WHEN** the same logical collaboration is retried with the same request identity or idempotency key
- **THEN** the system MUST correlate it to the existing managed request or safely deduplicate it
- **AND** operator-visible behavior MUST remain attributable to a single governed collaboration attempt

### Requirement: Correctness-Critical Managed A2A Behavior MUST Be Deterministic

The system SHALL keep correctness-critical collaboration behavior in deterministic plugin logic rather than requiring auxiliary model inference.

#### Scenario: Policy or transport decision is required
- **WHEN** the system must enforce publish restrictions, compatibility gates, bounded execution rules, or core delivery semantics
- **THEN** it MUST rely on deterministic runtime logic
- **AND** failure to invoke any optional auxiliary model MUST NOT break the correctness path

### Requirement: Model-Assisted Optimization MUST Remain Optional

The system SHALL treat auxiliary model usage as an optional optimization layer rather than a mandatory dependency for managed collaboration correctness.

#### Scenario: Optional semantic optimization is unavailable
- **WHEN** a future optimization such as semantic routing, compression, or diagnostic clustering is disabled or unavailable
- **THEN** the system MUST continue to provide governed managed collaboration through the deterministic core path
- **AND** the absence of that optimization MUST NOT weaken core policy guarantees

### Requirement: Managed A2A Core MUST Treat Single-Turn Delegation as the Minimal Interoperable Unit

The system SHALL define managed single-turn delegation as the initial collaboration unit for the core contract.

#### Scenario: A collaboration completes within one governed request
- **WHEN** a requester delegates work to a target agent and the target can complete without needing a persistent thread
- **THEN** the system MUST be able to represent and govern that collaboration as a single bounded managed request
- **AND** the system MUST NOT require multi-turn thread machinery for the core path

#### Scenario: Complex task benefits from specialist subtask execution
- **WHEN** a requester faces a complex task that would benefit from specialist domain context within the same trusted deployment
- **THEN** the system MUST allow the requester to delegate a bounded governed subtask to a specialist agent
- **AND** that delegation MUST preserve task-quality-improving collaboration without breaking the single-turn core model

### Requirement: Future Multi-Turn Collaboration MUST Use Explicit Thread Semantics

If the system later adds managed multi-turn collaboration, it SHALL do so through explicit thread and turn semantics rather than implicit repeated prompt exchange.

#### Scenario: Clarification is needed after initial delegation
- **WHEN** a target agent requires additional input or clarification after the initial collaboration request
- **THEN** any future multi-turn extension MUST represent the ongoing interaction through explicit thread or task continuity
- **AND** the extension MUST preserve bounded execution, policy enforcement, and auditability across turns

#### Scenario: Requester must quality-gate delegate output
- **WHEN** delegate output must be reviewed against the requester's top-level understanding of user intent
- **THEN** any future multi-turn extension MUST allow requester-side acceptance, correction, or refinement within the governed thread
- **AND** the thread model MUST preserve the requester as an explicit quality gate rather than reducing the exchange to free-form chat

#### Scenario: Requester chooses a gate action
- **WHEN** a requester evaluates delegate output within a future governed collaboration thread
- **THEN** the thread model MUST support explicit gate actions such as accept, reject, refine, clarify, reissue, or abort
- **AND** those actions MUST map to auditable thread or turn state transitions rather than remaining implicit in free-form prompts

#### Scenario: Requester refines the same delegate's output
- **WHEN** a requester determines that the current delegate remains the right specialist but the output needs correction or improvement
- **THEN** a refine action MUST keep the thread active with the same delegate continuing
- **AND** the action MUST NOT be misrepresented as a specialist handoff

#### Scenario: Requester reissues work to a different delegate
- **WHEN** a requester determines that the next bounded turn should be handled by a different specialist
- **THEN** the thread model MUST represent that change through an explicit handoff or equivalent state transition
- **AND** the original delegate MUST NOT appear to continue implicitly

#### Scenario: Requester rejects current output
- **WHEN** a requester rejects delegate output without choosing a correction or reissue path
- **THEN** the default thread outcome MUST be terminal non-acceptance
- **AND** further execution MUST require an explicit new requester action rather than an implicit retry
