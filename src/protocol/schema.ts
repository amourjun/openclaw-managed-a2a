import { Type } from "@sinclair/typebox";

export const ManagedA2ARequestSchema = Type.Object(
  {
    request_id: Type.String(),
    requester_agent_id: Type.String(),
    target_agent_id: Type.String(),
    question: Type.String(),
    mode: Type.Literal("orchestrated_internal"),
    ttl_seconds: Type.Integer({ minimum: 1 }),
    hop: Type.Integer({ minimum: 1 }),
    visited_agents: Type.Array(Type.String()),
    publish_contract: Type.Literal("evidence_only"),
    external_announce: Type.Union([Type.Literal("forbidden"), Type.Literal("allowed")]),
    source_chat_id: Type.Optional(Type.String()),
    timeout_seconds: Type.Optional(Type.Integer({ minimum: 1 })),
    idempotency_key: Type.Optional(Type.String()),
    metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false },
);
