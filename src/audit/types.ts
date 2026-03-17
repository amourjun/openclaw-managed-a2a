import type { ManagedA2AStatus } from "../protocol/types.js";

export type ManagedA2AAuditStage = ManagedA2AStatus;

export type ManagedA2AAuditEvent = {
  stage: ManagedA2AAuditStage;
  request_id: string;
  adapter_id?: string;
  message: string;
  details?: Record<string, unknown>;
};

export function buildManagedA2AAuditEvent(params: ManagedA2AAuditEvent): ManagedA2AAuditEvent {
  return params;
}

export function buildManagedA2AAuditRef(requestId: string): string {
  return `managed-a2a:${requestId}`;
}
