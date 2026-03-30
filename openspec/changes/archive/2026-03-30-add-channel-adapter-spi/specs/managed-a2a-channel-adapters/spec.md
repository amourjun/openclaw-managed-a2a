## ADDED Requirements
### Requirement: Managed A2A Core MUST Remain Channel-Agnostic

The system SHALL keep the canonical managed collaboration request contract independent of any one IM or channel-specific identifier scheme.

#### Scenario: Core delegation is used without any channel adapter
- **WHEN** a caller invokes the canonical managed-a2a entrypoint with a normalized request that already includes `requester_agent_id` and `target_agent_id`
- **THEN** the system MUST execute managed delegation without requiring Feishu, Telegram, Slack, or other channel-specific fields
- **AND** the collaboration outcome MUST remain governed by the same policy, transport, and audit rules

### Requirement: Managed A2A MUST Expose a Channel/Domain Adapter SPI

The system SHALL provide a channel/domain adapter boundary above the core contract so channel-native collaboration requests can be normalized into the canonical managed request envelope.

#### Scenario: Adapter receives channel-native request input
- **WHEN** a channel-facing collaboration tool receives channel-native identifiers, aliases, or chat context
- **THEN** the adapter MUST normalize requester identity, target identity, and source metadata before invoking the canonical core path
- **AND** the core execution path MUST NOT need to understand channel-native identifier semantics directly

### Requirement: Channel/Domain Adapters MUST Own Resolution Logic

The system SHALL assign requester inference, target lookup, and channel-specific ambiguity handling to adapters rather than the generic core request validator.

#### Scenario: Target resolution is ambiguous
- **WHEN** a channel adapter cannot resolve a unique `target_agent_id` from the provided channel-native input
- **THEN** the adapter MUST return an explicit clarification or unresolved-target outcome
- **AND** the system MUST NOT misreport that outcome as a transport failure or target execution failure

### Requirement: Reference Adapters MUST NOT Redefine the Product Identity

The system SHALL treat Feishu or any other initial adapter as a reference adapter layered above the generic product, not as the definition of the plugin itself.

#### Scenario: First adapter is implemented for one channel
- **WHEN** the first channel/domain adapter is introduced to support migration or adoption in a specific environment
- **THEN** the plugin documentation and architecture MUST continue to describe the product as a managed A2A collaboration layer rather than a channel-specific orchestration plugin
- **AND** the same SPI MUST remain applicable to future adapters for other channels

### Requirement: Adapter-Facing Compatibility Wrappers MUST Reuse the Core Execution Path

The system SHALL implement channel-facing compatibility entrypoints as thin wrappers above the canonical managed-a2a delegate path instead of maintaining a separate collaboration execution stack per channel.

#### Scenario: Legacy channel-specific caller is migrated
- **WHEN** a deployment needs a channel-oriented compatibility surface for migration or cutover
- **THEN** the adapter-facing wrapper MUST normalize the request and route it through the same core policy, transport, and audit flow
- **AND** the wrapper MUST NOT duplicate transport selection or parallel managed collaboration logic outside the core

### Requirement: Adapter Errors MUST Be Attributable Separately from Transport Errors

The system SHALL preserve structured diagnostics that distinguish adapter resolution problems from transport and execution problems.

#### Scenario: Adapter normalization fails before dispatch
- **WHEN** requester inference, target resolution, or source-context normalization fails in an adapter before managed dispatch begins
- **THEN** the system MUST surface the failure as an adapter-side resolution or normalization problem
- **AND** the failure MUST NOT be reported as a transport outage, timeout, or target execution error
