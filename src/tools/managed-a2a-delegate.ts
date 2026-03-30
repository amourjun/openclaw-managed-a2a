import { Type } from "@sinclair/typebox";
import { jsonResult, type AnyAgentTool, type OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolveManagedA2APluginConfig } from "../config.js";
import { buildManagedA2ADisabledResult, executeManagedA2ARequest } from "../core-execution.js";
import { ManagedA2AError, buildManagedA2AFailureResult } from "../errors.js";
import { MANAGED_A2A_DELEGATE_TOOL_NAME } from "../constants.js";
import { parseManagedA2ARequest } from "../policy/validate.js";

function extractRequestId(params: Record<string, unknown>): string {
  return typeof params.request_id === "string" && params.request_id.trim().length > 0
    ? params.request_id.trim()
    : "unknown";
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
        return jsonResult(buildManagedA2ADisabledResult(extractRequestId(params)));
      }

      try {
        const request = parseManagedA2ARequest(params, config);
        return jsonResult(
          await executeManagedA2ARequest({
            api,
            config,
            request,
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
            requestId: extractRequestId(params),
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
