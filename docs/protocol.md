# Managed A2A Protocol

## Status

This document describes the intended external contract for `openclaw-managed-a2a`.

- It is design guidance during the foundation stage.
- It is not yet a release guarantee.
- The goal is to keep this contract stable even if transport adapters change underneath.

## Deployment Assumption

The current core model assumes a trusted intra-instance domain-agent environment:

- agents are part of one governed OpenClaw deployment
- trust and operational control are shared
- collaboration is mainly about quality-improving delegation, not adversarial interoperability

This assumption explains why the protocol focuses on governed internal delegation before broader cross-boundary negotiation concerns.

## Purpose

The protocol exists to turn raw OpenClaw A2A/session primitives into a governed collaboration flow with:

- stable request identity
- policy-aware delegation rules
- multi-hop controls
- normalized lifecycle reporting
- transport-agnostic error semantics

## Structured Delegation Model

This protocol is based on structured delegation rather than prompt-only cooperation.

The intended invariants are:

1. Collaboration is a task-like contract with explicit identity and state.
2. Delivery is idempotent at the collaboration layer, even if transport is only at-least-once.
3. Execution is lease-bounded through `ttl_seconds` and related time budgets.
4. Delegation is well-founded through `hop` and `visited_agents`.
5. Policy enforcement is fail-closed and deterministic.

## Protocol Boundary

The protocol layer owns:

- request and response contract
- policy evaluation
- lifecycle states
- normalized error categories
- audit semantics

The transport layer does not own those rules. It only delivers the request through the best supported adapter.

## Distinction from Subagent Runtime

This protocol should not be conflated with a local subagent runtime primitive.

The intended distinction is:

- subagent support is a native execution primitive inside OpenClaw
- managed A2A is a governed delegation contract between domain agents

Subagents may still be part of the underlying implementation toolbox, but they are not the product-level abstraction this plugin is defining.

## Collaboration Layer Comparison

| Dimension | OpenClaw Subagent | Single-Turn Managed A2A | Future Multi-Turn Managed A2A |
|---|---|---|---|
| Collaboration unit | Local helper execution | One governed delegation request | One governed thread of turns |
| Identity model | Usually task-scoped | Stable requester and target agent identity | Stable agent identity plus thread and turn identity |
| Quality role | Assist current execution | Improve quality through specialist delegation | Improve quality through acceptance, correction, and convergence |
| Governance scope | Runtime-local | Request-level governance | Thread-level and turn-level governance |
| Best mental model | Execution primitive | Structured delegation | Quality-gated threaded collaboration |

## Core Concepts

### Collaboration Request

A collaboration request is a single governed attempt to ask one agent to perform internal delegated work for another agent.

This is currently the minimal collaboration unit for the core model.

### Managed Entrypoint

All governed collaboration must enter through one plugin-owned entrypoint rather than ad hoc direct calls.

### Publish Contract

The publish contract defines what kind of result is allowed to flow back to the requester or to external channels.

### Transport Adapter

The transport adapter is the delivery mechanism. It is replaceable. The protocol contract is not.

### Collaboration Thread

A collaboration thread is a future extension concept for multi-turn managed collaboration.

It is not required for the core single-turn path.

## Request Envelope

The exact tool schema may evolve, but the protocol should preserve these logical fields:

| Field | Required | Meaning |
|---|---|---|
| `request_id` | Yes | Stable identifier for correlation, idempotency, and audit |
| `requester_agent_id` | Yes | Agent initiating the collaboration |
| `target_agent_id` | Yes | Intended receiving agent |
| `question` | Yes | The internal work request or prompt payload |
| `mode` | Yes | Collaboration mode such as internal orchestrated delegation |
| `ttl_seconds` | Yes | Maximum allowed lifetime of the request |
| `hop` | Yes | Current hop count |
| `visited_agents` | Yes | Agent chain used for loop prevention |
| `publish_contract` | Yes | Output restriction such as `evidence_only` |
| `external_announce` | Yes | Whether external publication is forbidden or allowed |
| `source_chat_id` | No | Optional source conversation or operator context |
| `timeout_seconds` | No | Requester-level wait budget if different from TTL |
| `idempotency_key` | No | Optional caller-supplied dedupe key |
| `metadata` | No | Non-authoritative operator or routing metadata |

## Response Envelope

The protocol should normalize responses into a small set of outcomes:

| Field | Meaning |
|---|---|
| `request_id` | Correlates response to request |
| `status` | Final or current lifecycle status |
| `evidence` | Allowed response payload under the publish contract |
| `recommendation` | Operator-facing conclusion or next-step suggestion |
| `diagnostics` | Structured transport, policy, or compatibility details |
| `audit_ref` | Reference to audit record or lifecycle trace |

## Lifecycle

The protocol should normalize request progression into explicit states:

| State | Meaning |
|---|---|
| `accepted` | Request passed validation and entered managed handling |
| `dispatched` | Request was handed to a concrete transport adapter |
| `running` | Target execution is in progress |
| `completed` | Managed result returned within policy bounds |
| `rejected` | Policy or validation rejected the request before dispatch |
| `failed` | Execution or transport failed after dispatch |
| `expired` | TTL or timeout budget was exceeded |
| `degraded` | Fallback path was used and guarantees may be reduced in a controlled way |

Not every transport will expose every intermediate state, but the managed layer should map internal details into this normalized lifecycle.

## Current Boundary: Single-Turn Core

The current protocol is intentionally centered on single-turn managed delegation:

- one request envelope
- one bounded execution path
- one final outcome or explicit failure

Repeated back-and-forth can be modeled as multiple governed requests today, but that is different from a first-class multi-turn collaboration thread.

## Future Extension: Threaded Managed Collaboration

If the protocol grows into managed multi-turn collaboration, it should introduce explicit concepts such as:

- `collab_thread_id`
- `turn_id`
- `reply_to_turn_id`
- `thread_lease_seconds`
- `awaiting_party`

The goal would be to support clarification, suspend/resume, and bounded handoff without losing:

- idempotent correlation
- policy enforcement
- auditability
- lease-bounded execution

## Policy Semantics

### Identity and Correlation

- Every collaboration request must have a stable `request_id`.
- The managed layer should support dedupe and correlation through `request_id` or `idempotency_key`.

### Loop Prevention

- `visited_agents` records the collaboration path.
- The target agent must not already appear in the chain unless an explicit future policy allows it.
- `hop` must increment on every forwarded collaboration.

### TTL and Timeout

- `ttl_seconds` defines the maximum life of the collaboration contract.
- Transport-specific wait timeouts must not silently outlive TTL.
- Expiry should be reported as a protocol outcome, not as an ambiguous transport error.
- TTL is treated as a lease or deadline, not a best-effort hint.

### Publish Restrictions

- `publish_contract` constrains what the target may return.
- `external_announce=forbidden` means the managed layer must not allow external side effects as part of the collaboration response path.
- Skills may explain these restrictions, but enforcement belongs in plugin code.

### Target Resolution

- The protocol should resolve a logical target agent into a concrete transport target through a resolver or adapter layer.
- Channel-specific resolution, such as Feishu registry lookup, should stay outside the core protocol definition.

## Error Model

The protocol should normalize failures into operator-meaningful categories:

| Category | Meaning |
|---|---|
| `invalid_request` | Required fields or contract semantics are invalid |
| `policy_denied` | The request violates routing, publish, scope, or governance rules |
| `transport_unavailable` | No supported adapter path is currently usable |
| `transport_failed` | Selected adapter attempted delivery and failed |
| `compatibility_unsupported` | Runtime capability mismatch or version break |
| `execution_failed` | Target execution failed after successful dispatch |
| `timeout` | Request exceeded a time budget |

The system should avoid reporting compatibility or policy failures as generic execution failures.

## Skills and Prompts

Skills can help with:

- deciding when collaboration is appropriate
- shaping the question payload
- interpreting degraded-path behavior for operators

Skills must not be the only enforcement path for:

- publish restrictions
- TTL or hop rules
- auditability
- adapter selection
- compatibility gating

## Optional Model-Assisted Optimization

Future versions may introduce optional model-assisted features such as:

- semantic routing assistance
- evidence compression
- diagnostics clustering

Those features must remain optimization-only.

They must not become mandatory for:

- policy enforcement
- delivery correctness
- bounded execution
- compatibility gating

## Example Request Shape

```json
{
  "request_id": "req_20260317_001",
  "requester_agent_id": "domain-dsp-ops",
  "target_agent_id": "domain-multimedia-ops",
  "source_chat_id": "oc_xxx",
  "mode": "orchestrated_internal",
  "visited_agents": ["domain-dsp-ops"],
  "ttl_seconds": 30,
  "hop": 1,
  "publish_contract": "evidence_only",
  "external_announce": "forbidden",
  "question": "Health check: reply only OK"
}
```

## Non-Goals

This protocol is not intended to define:

- a general-purpose workflow engine
- agent planning strategies
- channel-specific directory schemas
- arbitrary external side-effect automation
