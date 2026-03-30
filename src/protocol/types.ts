export const managedA2AStatuses = [
  "accepted",
  "dispatched",
  "running",
  "completed",
  "rejected",
  "failed",
  "expired",
  "degraded",
] as const;

export type ManagedA2AStatus = (typeof managedA2AStatuses)[number];

export const managedA2AErrorCategories = [
  "invalid_request",
  "resolution_failed",
  "policy_denied",
  "transport_unavailable",
  "transport_failed",
  "compatibility_unsupported",
  "execution_failed",
  "timeout",
] as const;

export type ManagedA2AErrorCategory = (typeof managedA2AErrorCategories)[number];

export type ManagedA2ARequestEnvelope = {
  request_id: string;
  requester_agent_id: string;
  target_agent_id: string;
  question: string;
  mode: "orchestrated_internal";
  ttl_seconds: number;
  hop: number;
  visited_agents: string[];
  publish_contract: "evidence_only";
  external_announce: "forbidden" | "allowed";
  source_chat_id?: string;
  timeout_seconds?: number;
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
};

export type ManagedA2AErrorPayload = {
  category: ManagedA2AErrorCategory;
  message: string;
  details?: Record<string, unknown>;
};

export type ManagedA2ADiagnosticPayload = {
  category?: ManagedA2AErrorCategory;
  adapter_id?: string;
  reason?: string;
  supported_version_range?: string;
  probes?: unknown;
  audit_events?: unknown;
  details?: Record<string, unknown>;
};

export type ManagedA2AExecutionResult = {
  request_id: string;
  status: ManagedA2AStatus;
  evidence?: unknown;
  recommendation?: string;
  diagnostics?: ManagedA2ADiagnosticPayload;
  audit_ref?: string;
  error?: ManagedA2AErrorPayload;
};
