import type {
  ManagedA2ADiagnosticPayload,
  ManagedA2AErrorCategory,
  ManagedA2AErrorPayload,
  ManagedA2AExecutionResult,
  ManagedA2AStatus,
} from "./protocol/types.js";

export class ManagedA2AError extends Error {
  readonly category: ManagedA2AErrorCategory;
  readonly details?: Record<string, unknown>;

  constructor(
    category: ManagedA2AErrorCategory,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ManagedA2AError";
    this.category = category;
    if (details) {
      this.details = details;
    }
  }
}

export function buildManagedA2AErrorPayload(error: ManagedA2AError): ManagedA2AErrorPayload {
  return {
    category: error.category,
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
  };
}

export function buildManagedA2AFailureResult(params: {
  requestId: string;
  status: Extract<ManagedA2AStatus, "failed" | "rejected" | "expired" | "degraded">;
  error: ManagedA2AError;
  diagnostics?: ManagedA2ADiagnosticPayload;
  recommendation?: string;
  auditRef?: string;
}): ManagedA2AExecutionResult {
  return {
    request_id: params.requestId,
    status: params.status,
    error: buildManagedA2AErrorPayload(params.error),
    ...(params.diagnostics ? { diagnostics: params.diagnostics } : {}),
    ...(params.recommendation ? { recommendation: params.recommendation } : {}),
    ...(params.auditRef ? { audit_ref: params.auditRef } : {}),
  };
}
