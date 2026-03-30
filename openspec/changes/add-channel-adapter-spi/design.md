## Context
`managed-a2a` already has the right foundation:

- a channel-agnostic managed delegation contract
- deterministic policy validation
- transport adapter selection
- audit and diagnostics

What it does not yet have is a stable way to accept channel-native collaboration requests without polluting the core request schema. This matters because real deployments often arrive through a channel-specific domain-agent environment first, while the product itself must remain broader than any one IM ecosystem.

The current pressure comes from Feishu migration, but the design should also remain credible for Telegram, Slack, Discord, or future internal channels.

## Goals
- Keep the core managed-a2a contract IM-agnostic
- Define a stable SPI for channel/domain adapters
- Allow channel-native collaboration tools to be implemented as thin wrappers above the core delegate path
- Make adapter failures attributable and diagnosable
- Prove the SPI with one reference adapter without turning it into the product identity

## Non-Goals
- Build a general IM abstraction layer for unrelated messaging features
- Force every deployment to use a channel adapter
- Add multi-turn collaboration in this change
- Replace the current transport adapter strategy
- Split the repository into multiple npm packages before the SPI is proven

## Design Principles
1. Core first

The canonical managed collaboration contract remains the normalized request envelope accepted by `managed_a2a_delegate`.

2. Adapter above core

Channel/domain adapters sit above the core tool. They translate channel-native input into the normalized core envelope, then map the result back into an adapter-facing result shape if needed.

3. Channel-specific logic stays out of core

Requester resolution from chat/session context, target lookup from channel-native identifiers, and compatibility wrappers belong to adapters, not the core protocol.

4. Error attribution stays explicit

The system must distinguish:

- adapter resolution failure
- policy rejection
- transport unavailability or transport failure
- target execution failure

## Proposed Shape
The minimal MVP should add an internal adapter SPI inside the same repository:

```text
managed-a2a core
  ├─ managed_a2a_delegate
  ├─ policy validation
  ├─ transport adapters
  └─ audit and diagnostics
           ▲
           │ normalized request/result
           ▼
channel/domain adapter SPI
  ├─ resolveRequester(...)
  ├─ resolveTarget(...)
  ├─ buildSourceMetadata(...)
  └─ mapResult(...)
           ▲
           │ channel-native params
           ▼
reference adapters
  ├─ feishu
  └─ future telegram/slack/etc.
```

## Adapter SPI Responsibilities
An adapter should be able to do the following:

- accept channel-native input for a collaboration request
- resolve or infer `requester_agent_id`
- resolve `target_agent_id` from channel-native selectors such as chat IDs, aliases, or fuzzy target hints
- return clarification candidates when target resolution is ambiguous
- add channel/source metadata without changing the core request contract
- optionally expose an adapter-facing result shape for legacy compatibility callers

The core should not need to know how a Feishu chat ID or Telegram peer ID works.

## Canonical Entry Points
The MVP should keep two layers of entrypoints:

1. Core canonical entrypoint

- `managed_a2a_delegate`
- requires normalized managed request fields
- remains usable even when no channel adapter is installed

2. Adapter-facing entrypoints

- examples: `managed_a2a_feishu_delegate`, future `managed_a2a_telegram_delegate`
- accept channel-native parameters
- normalize input through the adapter, then delegate to the same core path

This keeps the product message clean:

- the core tool is the real contract
- adapter tools are convenience and migration surfaces

## MVP Scope
The MVP should include:

- adapter SPI definitions
- adapter registration/selection plumbing
- adapter-aware diagnostics
- one reference Feishu/domain adapter
- one thin compatibility wrapper for Feishu-oriented cutover testing

The MVP should not yet include:

- multiple reference adapters
- separate package publishing for each adapter
- channel-specific admin, directory, or registry write APIs inside this repository

## Feishu As Reference Adapter
Feishu is the right first adapter because it is the current migration pressure and provides immediate cutover value. But it must remain a reference adapter:

- not required for generic plugin use
- not embedded into the core schema
- not described as the product identity

The same SPI should support a future Telegram adapter where the only differences are:

- requester resolution source
- target lookup rules
- source metadata fields
- optional compatibility wrapper naming

## Migration Path
The expected migration path is:

1. Prove the core path with `managed_a2a_delegate`
2. Add the channel/domain adapter SPI
3. Add a Feishu reference adapter and compatibility wrapper
4. In the old deployment, disable or stop registering the legacy collaboration entrypoint
5. Load the new plugin and route collaboration through the adapter wrapper above the same core execution path

This migration keeps the transport, policy, and audit logic in one place instead of maintaining parallel collaboration stacks.

## Testing
The change should add:

- unit tests for adapter normalization and error attribution
- a core smoke test with no adapter present
- a reference-adapter smoke test above the same core execution path
- validation that adapter resolution failures are not misreported as transport failures
