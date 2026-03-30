## 1. Specification
- [x] 1.1 Define the channel/domain adapter SPI and its ownership boundary relative to the core managed-a2a contract
- [x] 1.2 Define normalized error attribution for adapter resolution, transport failure, and execution failure
- [x] 1.3 Define the role of reference adapters versus the generic core product identity

## 2. Core Architecture
- [x] 2.1 Add adapter interface types and an adapter registry or selection mechanism in the plugin runtime
- [x] 2.2 Preserve `managed_a2a_delegate` as the canonical normalized core entrypoint
- [x] 2.3 Add adapter-facing normalization helpers for requester resolution, target resolution, and source metadata
- [x] 2.4 Add adapter-aware diagnostics so adapter failures are reported distinctly from transport failures

## 3. Reference Adapter
- [x] 3.1 Add a first reference Feishu/domain adapter that proves the SPI without moving Feishu assumptions into the core schema
- [x] 3.2 Implement a thin Feishu-facing compatibility wrapper that normalizes legacy-style inputs into the core request envelope
- [x] 3.3 Document how the same SPI can support Telegram, Slack, or future channel adapters

## 4. Verification
- [x] 4.1 Add focused tests for adapter registration, normalization, and failure attribution
- [x] 4.2 Add a smoke-test path that exercises the core tool without any channel adapter
- [x] 4.3 Add a smoke-test path that exercises the Feishu reference adapter above the same core execution path
- [x] 4.4 Run `openspec validate add-channel-adapter-spi --strict`
