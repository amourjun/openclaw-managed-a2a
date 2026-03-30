import { persistManagedA2AAuditTrace } from "./audit/store.js";
import { buildManagedA2AAuditEvent, buildManagedA2AAuditRef } from "./audit/types.js";
import type { ManagedA2AAuditEvent } from "./audit/types.js";
import type { ManagedA2AResolvedConfig } from "./config.js";
import { MANAGED_A2A_SUPPORTED_OPENCLAW_RANGE } from "./constants.js";
import { ManagedA2AError, buildManagedA2AFailureResult } from "./errors.js";
import { probeManagedA2ATransportCapabilities } from "./probes/capabilities.js";
import type { ManagedA2AExecutionResult, ManagedA2ARequestEnvelope } from "./protocol/types.js";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

async function finalizeManagedA2AResult(params: {
  api: OpenClawPluginApi;
  config: ManagedA2AResolvedConfig;
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

export function buildManagedA2ADisabledResult(requestId: string): ManagedA2AExecutionResult {
  return buildManagedA2AFailureResult({
    requestId,
    status: "rejected",
    error: new ManagedA2AError("policy_denied", "managed-a2a plugin is disabled by configuration"),
    recommendation: "Enable the managed-a2a plugin before invoking managed delegation.",
  });
}

export async function executeManagedA2ARequest(params: {
  api: OpenClawPluginApi;
  config: ManagedA2AResolvedConfig;
  request: ManagedA2ARequestEnvelope;
}): Promise<ManagedA2AExecutionResult> {
  const auditEvents = [
    buildManagedA2AAuditEvent({
      stage: "accepted",
      request_id: params.request.request_id,
      message: "Managed single-turn delegation request accepted",
    }),
  ];

  try {
    const selection = await probeManagedA2ATransportCapabilities({
      api: params.api,
      config: params.config,
      request: params.request,
      auditEvents,
    });

    if (!selection.adapter) {
      auditEvents.push(
        buildManagedA2AAuditEvent({
          stage: "failed",
          request_id: params.request.request_id,
          message: selection.reason,
        }),
      );

      return await finalizeManagedA2AResult({
        api: params.api,
        config: params.config,
        request: params.request,
        auditEvents,
        result: buildManagedA2AFailureResult({
          requestId: params.request.request_id,
          status: "failed",
          error: new ManagedA2AError("transport_unavailable", selection.reason),
          diagnostics: {
            category: "transport_unavailable",
            reason: selection.reason,
            probes: selection.probes,
            details: {
              preferred_adapter: params.config.preferredAdapter,
              allow_cli_fallback: params.config.allowCliFallback,
            },
          },
          recommendation:
            "Implement the primary adapter or wire the CLI fallback before using managed delegation end-to-end.",
          auditRef: buildManagedA2AAuditRef(params.request.request_id),
        }),
      });
    }

    auditEvents.push(
      buildManagedA2AAuditEvent({
        stage: selection.used_fallback ? "degraded" : "dispatched",
        request_id: params.request.request_id,
        adapter_id: selection.adapter.id,
        message: selection.reason,
      }),
    );

    return await finalizeManagedA2AResult({
      api: params.api,
      config: params.config,
      request: params.request,
      auditEvents,
      result: await selection.adapter.execute({
        api: params.api,
        config: params.config,
        request: params.request,
        auditEvents,
      }),
    });
  } catch (error) {
    const managedError =
      error instanceof ManagedA2AError
        ? error
        : new ManagedA2AError("execution_failed", "Unexpected managed-a2a error", {
            cause: error instanceof Error ? error.message : String(error),
          });

    return buildManagedA2AFailureResult({
      requestId: params.request.request_id,
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
  }
}
