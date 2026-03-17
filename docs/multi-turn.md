# Managed Multi-Turn Collaboration

## Status

This document describes a future extension direction for `openclaw-managed-a2a`.

- It is not part of the current v1 core contract.
- The current core should remain single-turn managed delegation.
- The goal of this document is to prevent future multi-turn support from becoming ad hoc or prompt-only.

## Why This Matters

Single-turn delegation is enough for many governed collaboration tasks, but it is not enough for:

- clarification loops
- requester follow-up within the same governed collaboration
- target-agent questions before completion
- suspend and resume flows
- bounded multi-step internal coordination that should remain inside one collaboration thread

If these cases are added later without an explicit model, the system will drift into repeated prompt exchange with weak governance.

## Value of Multi-Turn Collaboration

The value of multi-turn collaboration is not just "more back-and-forth."

Its real value is that it preserves governance across an ongoing collaboration thread:

- clarification stays inside the governed contract
- turn history becomes explicit and reviewable
- long-running collaboration can suspend and resume cleanly
- handoff and waiting states can be bounded instead of implied
- operators can audit a thread rather than reverse-engineer repeated one-off requests

In a trusted domain-agent system, the most important extra value is quality gating:

- the requester keeps the most authoritative view of the user's real goal
- the delegate can focus on specialist execution
- returned results can be checked, corrected, or reframed under the top-level task context
- prompt tuning and follow-up can happen inside one governed thread instead of being lost across unrelated retries

## Current Core Boundary

Today the cleanest core is:

- one governed request
- one lease-bounded execution path
- one managed outcome

This keeps idempotency, audit boundaries, fallback behavior, and failure semantics understandable.

That is why single-turn delegation remains the right default value unit for v1:

- it solves many high-frequency collaboration cases already
- it is easier to make reliable across mixed transport paths
- it gives immediate product value before thread machinery exists

## Future Threaded Model

Managed multi-turn collaboration should be modeled as a thread of governed turns, not as loosely related repeated requests.

Suggested logical fields:

| Field | Meaning |
|---|---|
| `collab_thread_id` | Stable identity for a collaboration thread |
| `turn_id` | Stable identity for a single exchange within the thread |
| `reply_to_turn_id` | Parent or preceding turn linkage |
| `thread_lease_seconds` | Maximum life of the collaboration thread |
| `awaiting_party` | Which side must act next |
| `thread_state` | Current thread lifecycle state |

## Proposed Thread States

| State | Meaning |
|---|---|
| `active` | Thread is live and work is ongoing |
| `awaiting_input` | One side requires clarification or additional input |
| `handed_off` | Control has moved to another bounded participant |
| `resumed` | Work resumed after a wait or clarification |
| `completed` | Thread ended successfully |
| `aborted` | Thread was explicitly terminated |
| `expired` | Thread lease ended before successful completion |

## Turn Semantics

Each turn should still preserve the structured delegation invariants:

- explicit identity
- bounded execution
- auditable state transition
- deterministic policy checks

Possible turn types:

- `request_turn`
- `clarification_turn`
- `answer_turn`
- `handoff_turn`
- `completion_turn`
- `abort_turn`

In this model, the top-level requester is not just another speaker in the loop.

It is often the quality gate for the thread:

- it holds the authoritative task framing
- it decides whether delegate output is acceptable
- it can ask for correction, refinement, or clarification before completion

## Requester Gate Actions

To keep multi-turn collaboration governed, the requester-side quality gate should act through a small explicit action set rather than free-form conversational drift.

| Action | Meaning | Typical Next State |
|---|---|---|
| `accept` | Delegate output is sufficient and the thread can conclude successfully | `completed` |
| `reject` | Delegate output is not acceptable and should not be treated as successful | `aborted` or requester-controlled retry path |
| `refine` | Delegate output is directionally useful but needs revision under the same goal | `active` |
| `clarify` | Requester asks a bounded follow-up question to resolve ambiguity | `awaiting_input` or `resumed` |
| `reissue` | Requester sends a revised bounded task based on what was learned | `active` |
| `abort` | Collaboration is intentionally terminated without successful completion | `aborted` |

The point of this action set is not to restrict implementation creativity. It is to preserve:

- auditable reviewer intent
- bounded state transitions
- explicit acceptance semantics
- quality convergence instead of chat sprawl

`reject` and `reissue` are intentionally different:

- `reject` says the current output is not accepted
- `reissue` says a new bounded turn should begin under revised instructions

`refine` and `clarify` are also intentionally different:

- `refine` asks for improvement of the current output direction
- `clarify` resolves uncertainty before the next substantive output

## Gate Action State Transitions

The default thread model should map gate actions to explicit state transitions and explicit delegate-continuation rules.

| Action | Typical Source State | Thread Transition | Original Delegate Continues? | Notes |
|---|---|---|---|---|
| `accept` | `active`, `resumed` | `completed` | No | Successful terminal action |
| `reject` | `active`, `resumed` | `aborted` | No | Explicit non-acceptance without silent retry |
| `refine` | `active`, `resumed` | `active` | Yes, same delegate | Same goal, corrected output direction |
| `clarify` | `active`, `resumed` | `awaiting_input` -> `resumed` | Yes, same delegate | Bounded follow-up before next substantive output |
| `reissue` to same delegate | `active`, `resumed` | `active` | Yes, same delegate, new bounded turn | Revised task framing, same specialist still fits |
| `reissue` to different delegate | `active`, `resumed` | `handed_off` -> `active` | No, new delegate takes over | Specialist mismatch or domain boundary change |
| `abort` | `active`, `resumed`, `awaiting_input`, `handed_off` | `aborted` | No | Intentional terminal stop |

## Delegate Continuation Policy

The key distinction is between thread continuity and executor continuity.

- `refine` preserves both thread continuity and executor continuity.
- `clarify` preserves both thread continuity and executor continuity.
- `reissue` preserves thread continuity, but executor continuity depends on whether the same specialist is still correct.
- `accept`, `reject`, and `abort` terminate executor continuity.

Default policy:

1. Keep the same delegate when the problem is output quality, missing detail, or bounded ambiguity.
2. Change delegate only when the requester believes the current specialist is no longer the right executor.
3. Do not overload `reject` to mean "try again." Use `reissue` for that so audit history stays clear.

## Why These Defaults

These defaults are intentional.

1. They separate review semantics cleanly.
   - `accept` means success.
   - `reject` means non-acceptance.
   - `reissue` means continue under revised instructions.

2. They keep audit trails legible.
   - A reader can tell whether the problem was bad output, missing clarity, or wrong specialist selection.

3. They preserve specialist context when it is still useful.
   - `refine` and `clarify` stay with the same delegate because switching executors would throw away useful local prompt, memory, and tool context.

4. They make handoff explicit when specialization changes.
   - Changing the delegate should not be smuggled inside a generic correction loop.
   - That is why cross-specialist continuation goes through `reissue` and `handed_off`.

5. They bound failure and retry behavior.
   - `reject` and `abort` are terminal by default so threads do not drift into implicit retry loops.

## Termination Model

Multi-turn collaboration should still have strong termination guarantees.

That means:

- thread-level lease must be bounded
- turn-level waits must not exceed thread lease
- handoff chains must remain loop-safe
- suspension must be observable
- abort and expiry must be explicit terminal outcomes

## Theoretical Anchors

### A2A Task and Context Semantics

The best protocol-level reference is A2A:

- tasks have explicit state
- context continuity is first-class
- history can be associated with the task
- long-running work supports streaming and asynchronous updates
- `input-required` provides a clean interruption pattern

This makes A2A the strongest conceptual base for thread and turn continuity.

### AutoGen Handoff and Termination Patterns

The best runtime-level reference is AutoGen:

- swarm uses explicit handoff between agents
- shared context can flow across participants
- termination conditions are explicit
- graph-based execution patterns allow bounded cycles and structured control

This makes AutoGen useful for thinking about turn routing and handoff discipline.

### LangGraph State, Checkpointing, and Supervisor Control

The best systems-level reference is LangGraph:

- explicit state graphs
- checkpointing and restore
- supervisor-controlled communication flow
- message history management
- persistence for long-running workflows

This makes LangGraph useful for thread durability and resume semantics.

## Design Constraints

Future multi-turn support should not:

- weaken single-turn guarantees
- require auxiliary models for correctness
- depend on prompt conventions alone
- hide thread state inside transport-specific session internals

## Open Questions

- Should each thread have a central coordinator, or should handoff stay decentralized under bounded rules?
- What must be persisted at thread scope versus turn scope?
- How much shared history should be visible to each participant by default?
