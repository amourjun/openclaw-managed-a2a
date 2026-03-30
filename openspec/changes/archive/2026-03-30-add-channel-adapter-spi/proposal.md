## Why
The current `managed-a2a` core is correctly positioned as an IM-agnostic managed collaboration layer, but the next practical migration pressure comes from channel-specific deployments such as Feishu domain agents. If the project jumps straight to a Feishu-specific implementation without first defining a reusable adapter boundary, the core will inherit channel assumptions that should stay outside the product identity.

The right MVP is therefore not "make managed-a2a a Feishu plugin." The right MVP is to define a channel/domain adapter SPI that lets channel-native inputs be normalized into the existing core request contract, while keeping the core transport, policy, and audit path channel-agnostic. Feishu can then be implemented as the first reference adapter for cutover value, without becoming the architecture.

This also keeps the plugin aligned with the broader goal of supporting other mainstream IM environments such as Telegram, Slack, or future internal channels through the same adapter shape.

## What Changes
- Add a channel/domain adapter SPI above the existing managed-a2a core contract
- Keep `managed_a2a_delegate` as the canonical core entrypoint for normalized managed delegation
- Define adapter-owned responsibilities:
  - requester resolution from channel context
  - target resolution from channel-native identifiers or aliases
  - channel/source metadata normalization
  - optional compatibility result mapping for channel-facing callers
- Define core-owned responsibilities:
  - managed request validation
  - policy enforcement
  - transport adapter selection and execution
  - audit persistence and diagnostics
- Add a first reference adapter for Feishu/domain-agent deployments to prove the SPI and support future cutover from `feishu-ext`
- Explicitly position Feishu as a reference adapter, not as the product identity
- Define failure boundaries so adapter resolution errors are distinguishable from transport and execution failures
- Document a migration path in which channel-specific collaboration tools can be reimplemented as thin wrappers above the core delegate tool

## Non-Goals
- Do not make Feishu-specific registry or chat semantics part of the managed-a2a core request schema
- Do not require every OpenClaw deployment to use a channel adapter
- Do not implement Telegram, Slack, or other channel adapters in this same MVP beyond proving the SPI can support them
- Do not replace the existing core transport adapters (`runtime_subagent`, `cli_fallback`) as part of this change
- Do not turn the plugin into a channel router or IM abstraction layer for non-collaboration features
- Do not commit this proposal to a separate npm package split before the SPI is validated in one repository

## Impact
- Affected specs:
  - `managed-a2a-channel-adapters`
- Expected follow-up work:
  - define adapter interface and lifecycle
  - define adapter-facing input and result normalization rules
  - add a reference Feishu/domain adapter
  - add adapter-aware smoke tests and compatibility checks
  - later add additional adapters such as Telegram or Slack if needed
