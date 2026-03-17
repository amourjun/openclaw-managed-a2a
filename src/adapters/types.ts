import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { ManagedA2AResolvedConfig } from "../config.js";
import type { ManagedA2AAuditEvent } from "../audit/types.js";
import type { ManagedA2AExecutionResult, ManagedA2ARequestEnvelope } from "../protocol/types.js";

export const managedA2ATransportAdapterIds = [
  "runtime_subagent",
  "cli_fallback",
] as const;

export type ManagedA2ATransportAdapterId = (typeof managedA2ATransportAdapterIds)[number];

export type ManagedA2AAdapterProbe = {
  adapter_id: ManagedA2ATransportAdapterId;
  supported: boolean;
  reason?: string;
  details?: Record<string, unknown>;
};

export type ManagedA2AAdapterExecutionContext = {
  api: OpenClawPluginApi;
  config: ManagedA2AResolvedConfig;
  request: ManagedA2ARequestEnvelope;
  auditEvents: ManagedA2AAuditEvent[];
};

export interface ManagedA2ATransportAdapter {
  readonly id: ManagedA2ATransportAdapterId;
  readonly label: string;
  probe(context: ManagedA2AAdapterExecutionContext): Promise<ManagedA2AAdapterProbe>;
  execute(context: ManagedA2AAdapterExecutionContext): Promise<ManagedA2AExecutionResult>;
}

export type ManagedA2AAdapterSelection = {
  adapter?: ManagedA2ATransportAdapter;
  reason: string;
  probes: ManagedA2AAdapterProbe[];
  used_fallback: boolean;
};
