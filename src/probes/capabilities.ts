import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { ManagedA2AResolvedConfig } from "../config.js";
import type { ManagedA2AAuditEvent } from "../audit/types.js";
import type { ManagedA2ARequestEnvelope } from "../protocol/types.js";
import { createCliFallbackAdapter } from "../adapters/cli-fallback.js";
import { createRuntimeSubagentAdapter } from "../adapters/runtime-subagent.js";
import { selectManagedA2ATransportAdapter } from "../adapters/selector.js";
import type { ManagedA2AAdapterSelection } from "../adapters/types.js";

export async function probeManagedA2ATransportCapabilities(params: {
  api: OpenClawPluginApi;
  config: ManagedA2AResolvedConfig;
  request: ManagedA2ARequestEnvelope;
  auditEvents: ManagedA2AAuditEvent[];
}): Promise<ManagedA2AAdapterSelection> {
  const context = {
    api: params.api,
    config: params.config,
    request: params.request,
    auditEvents: params.auditEvents,
  };

  const adapters = [createRuntimeSubagentAdapter(), createCliFallbackAdapter()];
  const candidates = await Promise.all(
    adapters.map(async (adapter) => ({
      adapter,
      probe: await adapter.probe(context),
    })),
  );

  return selectManagedA2ATransportAdapter({
    config: params.config,
    candidates,
  });
}
