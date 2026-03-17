import { Type } from "@sinclair/typebox";
import {
  jsonResult,
  type AnyAgentTool,
  type OpenClawPluginApi,
} from "openclaw/plugin-sdk";
import { persistManagedA2AAuditTrace } from "../audit/store.js";
import { buildManagedA2AAuditEvent, buildManagedA2AAuditRef } from "../audit/types.js";
import { resolveManagedA2APluginConfig } from "../config.js";
import { MANAGED_A2A_DELEGATE_TOOL_NAME, MANAGED_A2A_SUPPORTED_OPENCLAW_RANGE } from "../constants.js";
import { ManagedA2AError, buildManagedA2AFailureResult } from "../errors.js";
import { parseManagedA2ARequest } from "../policy/validate.js";
import type { ManagedA2AAuditEvent } from "../audit/types.js";
import type { ManagedA2AExecutionResult, ManagedA2ARequestEnvelope } from "../protocol/types.js";
import { probeManagedA2ATransportCapabilities } from "../probes/capabilities.js";

async function finalizeManagedA2AResult(params: {
  api: OpenClawPluginApi;
  config: ReturnType<typeof resolveManagedA2APluginConfig>;
  request: ManagedA2ARequestEnvelope;
  auditEvents: ManagedA2AAuditEvent[];
  result: ManagedA2AExecutionResult;
}): Promise<ManagedA2AExecutionResult> {
  const diagnostics = {
    ...(params.result.diagnostics ?? {}),
    supported_version_range: MANAGED_A2A_SUPPORTED_OPENCLAW_RANGE,
    audit_events: params.auditEvents,
  };

  let result: ManagedA2AExecutionResult = {
    ...params.result,
    diagnostics,
  };

  try {
    const auditPath = await persistManagedA2AAuditTrace({
      api: params.api,
      config: params.config,
      request: params.request,
      result,
      auditEvents: params.auditEvents,
    });

    result = {
      ...result,
      audit_ref: auditPath,
      diagnostics: {
        ...diagnostics,
        details: {
          ...(diagnostics.details ?? {}),
          audit_path: auditPath,
        },
      },
    };
  } catch (error) {
    params.api.logger.warn?.(
      `managed-a2a: failed to persist audit trace (request_id=${params.request.request_id}, error=${error instanceof Error ? error.message : String(error)})`,
    );
  }

  return result;
}

export function createManagedA2ADelegateTool(api: OpenClawPluginApi): AnyAgentTool {
  return {
    name: MANAGED_A2A_DELEGATE_TOOL_NAME,
    label: "Managed A2A Delegate",
    description:
      "Validate and prepare a governed single-turn delegation request for trusted intra-instance domain-agent collaboration.",
    parameters: Type.Object({
      request_id: Type.String(),
      requester_agent_id: Type.String(),
      target_agent_id: Type.String(),
      question: Type.String(),
      mode: Type.Literal("orchestrated_internal"),
      ttl_seconds: Type.Optional(Type.Integer({ minimum: 1 })),
      hop: Type.Integer({ minimum: 1 }),
      visited_agents: Type.Array(Type.String()),
      publish_contract: Type.Literal("evidence_only"),
      external_announce: Type.Union([Type.Literal("forbidden"), Type.Literal("allowed")]),
      source_chat_id: Type.Optional(Type.String()),
      timeout_seconds: Type.Optional(Type.Integer({ minimum: 1 })),
      idempotency_key: Type.Optional(Type.String()),
      metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    }),

    async execute(_id: string, params: Record<string, unknown>) {
      const config = resolveManagedA2APluginConfig(api.pluginConfig);

      if (!config.enabled) {
        return jsonResult(
          buildManagedA2AFailureResult({
            requestId: typeof params.request_id === "string" ? params.request_id : "unknown",
            status: "rejected",
            error: new ManagedA2AError(
              "policy_denied",
              "managed-a2a plugin is disabled by configuration",
            ),
            recommendation: "Enable the managed-a2a plugin before invoking managed delegation.",
          }),
        );
      }

      try {
        const request = parseManagedA2ARequest(params, config);
        const auditEvents = [
          buildManagedA2AAuditEvent({
            stage: "accepted",
            request_id: request.request_id,
            message: "Managed single-turn delegation request accepted",
          }),
        ];

        const selection = await probeManagedA2ATransportCapabilities({
          api,
          config,
          request,
          auditEvents,
        });

        if (!selection.adapter) {
          auditEvents.push(
            buildManagedA2AAuditEvent({
              stage: "failed",
              request_id: request.request_id,
              message: selection.reason,
            }),
          );

          return jsonResult(
            await finalizeManagedA2AResult({
              api,
              config,
              request,
              auditEvents,
              result: buildManagedA2AFailureResult({
                requestId: request.request_id,
                status: "failed",
                error: new ManagedA2AError("transport_unavailable", selection.reason),
                diagnostics: {
                  category: "transport_unavailable",
                  reason: selection.reason,
                  probes: selection.probes,
                  details: {
                    preferred_adapter: config.preferredAdapter,
                    allow_cli_fallback: config.allowCliFallback,
                  },
                },
              recommendation:
                "Implement the primary adapter or wire the CLI fallback before using managed delegation end-to-end.",
              auditRef: buildManagedA2AAuditRef(request.request_id),
            }),
            }),
          );
        }

        auditEvents.push(
          buildManagedA2AAuditEvent({
            stage: selection.used_fallback ? "degraded" : "dispatched",
            request_id: request.request_id,
            adapter_id: selection.adapter.id,
            message: selection.reason,
          }),
        );

        return jsonResult(
          await finalizeManagedA2AResult({
            api,
            config,
            request,
            auditEvents,
            result: await selection.adapter.execute({ api, config, request, auditEvents }),
          }),
        );
      } catch (error) {
        const managedError =
          error instanceof ManagedA2AError
            ? error
            : new ManagedA2AError("execution_failed", "Unexpected managed-a2a error", {
                cause: error instanceof Error ? error.message : String(error),
              });

        return jsonResult(
          buildManagedA2AFailureResult({
            requestId: typeof params.request_id === "string" ? params.request_id : "unknown",
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
          }),
        );
      }
    },
  };
}
