import { jsonResult, type AnyAgentTool, type OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolveManagedA2APluginConfig } from "../config.js";
import { buildManagedA2ADisabledResult, executeManagedA2ARequest } from "../core-execution.js";
import { ManagedA2AError, buildManagedA2AFailureResult } from "../errors.js";
import { parseManagedA2ARequest } from "../policy/validate.js";
import type { ManagedA2AChannelAdapter } from "../channel-adapters/types.js";

function extractRequestId(params: Record<string, unknown>, fallback = "unknown"): string {
  return typeof params.request_id === "string" && params.request_id.trim().length > 0
    ? params.request_id.trim()
    : fallback;
}

export function createManagedA2AChannelAdapterTool(
  api: OpenClawPluginApi,
  adapter: ManagedA2AChannelAdapter,
): AnyAgentTool {
  return {
    name: adapter.toolName,
    label: adapter.label,
    description: adapter.description,
    parameters: adapter.parameters,
    async execute(_id: string, rawParams: Record<string, unknown>) {
      const config = resolveManagedA2APluginConfig(api.pluginConfig);

      if (!config.enabled) {
        const requestId = extractRequestId(rawParams);
        const disabledResult = buildManagedA2ADisabledResult(requestId);
        const payload = adapter.mapError?.({
          api,
          config,
          error: new ManagedA2AError("policy_denied", "managed-a2a plugin is disabled by configuration"),
          requestId,
          rawParams,
        }) ?? disabledResult;
        return jsonResult(payload);
      }

      let normalizationState: Record<string, unknown> | undefined;
      let normalizedRequest: Record<string, unknown> | undefined;

      try {
        const normalized = await adapter.normalize({
          api,
          config,
          rawParams,
        });

        if (normalized.kind === "terminal") {
          return jsonResult(normalized.payload);
        }

        normalizationState = normalized.state;
        normalizedRequest = normalized.request;
        const request = parseManagedA2ARequest(normalized.request, config);
        const result = await executeManagedA2ARequest({
          api,
          config,
          request,
        });
        const payload = adapter.mapResult?.({
          api,
          config,
          result,
          request,
          ...(normalizationState ? { state: normalizationState } : {}),
        }) ?? result;
        return jsonResult(payload);
      } catch (error) {
        const managedError =
          error instanceof ManagedA2AError
            ? error
            : new ManagedA2AError("execution_failed", "Unexpected adapter execution error", {
                cause: error instanceof Error ? error.message : String(error),
              });
        const requestId = extractRequestId(normalizedRequest ?? rawParams);
        let request;
        if (normalizedRequest && managedError.category !== "invalid_request") {
          try {
            request = parseManagedA2ARequest(normalizedRequest, config);
          } catch {
            request = undefined;
          }
        }
        const payload = adapter.mapError?.({
          api,
          config,
          error: managedError,
          requestId,
          rawParams,
          ...(normalizedRequest ? { normalizedRequest } : {}),
          ...(request ? { request } : {}),
          ...(normalizationState ? { state: normalizationState } : {}),
        }) ?? buildManagedA2AFailureResult({
          requestId,
          status:
            managedError.category === "policy_denied"
              ? "rejected"
              : managedError.category === "timeout"
                ? "expired"
                : "failed",
          error: managedError,
          diagnostics: {
            category: managedError.category,
            reason: managedError.message,
            ...(managedError.details ? { details: managedError.details } : {}),
          },
        });
        return jsonResult(payload);
      }
    },
  };
}
