import { buildManagedA2AAuditEvent, buildManagedA2AAuditRef } from "../audit/types.js";
import { ManagedA2AError, buildManagedA2AFailureResult } from "../errors.js";
import type { ManagedA2AExecutionResult } from "../protocol/types.js";
import type { ManagedA2ATransportAdapter } from "./types.js";
import {
  asRecord,
  buildManagedA2ADelegationMessage,
  buildManagedA2ATargetSessionKey,
  errorMessage,
  extractLatestAssistantText,
  isSubagentRuntimeUnavailableError,
  normalizeString,
  parseManagedA2ATextReply,
} from "./shared.js";
import { createCliFallbackAdapter } from "./cli-fallback.js";

function resolveRequestTimeoutMs(ttlSeconds: number, timeoutSeconds?: number): number {
  return Math.max(1000, (timeoutSeconds ?? ttlSeconds) * 1000);
}

function buildSuccessResult(params: {
  requestId: string;
  targetAgentId: string;
  targetSessionKey: string;
  runId: string;
  text: string;
}): ManagedA2AExecutionResult {
  const parsed = parseManagedA2ATextReply(params.text, params.requestId);

  return {
    request_id: params.requestId,
    status: "completed",
    evidence: {
      target_agent_id: params.targetAgentId,
      target_session_key: params.targetSessionKey,
      run_id: params.runId,
      text: parsed.evidence_text ?? parsed.raw_text,
      raw_text: parsed.raw_text,
      response_marker_matched: parsed.response_marker_matched,
    },
    ...(parsed.recommendation ? { recommendation: parsed.recommendation } : {}),
    diagnostics: {
      adapter_id: "runtime_subagent",
      reason: "Delegation completed through runtime subagent transport",
      details: {
        target_session_key: params.targetSessionKey,
        run_id: params.runId,
        response_marker_matched: parsed.response_marker_matched,
      },
    },
    audit_ref: buildManagedA2AAuditRef(params.requestId),
  };
}

export function createRuntimeSubagentAdapter(): ManagedA2ATransportAdapter {
  return {
    id: "runtime_subagent",
    label: "Runtime Subagent",
    async probe(context) {
      const subagent = context.api.runtime?.subagent;
      const supported =
        typeof subagent?.run === "function" &&
        typeof subagent.waitForRun === "function" &&
        typeof subagent.getSessionMessages === "function";

      return supported
        ? {
            adapter_id: "runtime_subagent",
            supported: true,
            reason: "Official runtime subagent APIs are available",
            details: {
              runtime_version: context.api.runtime.version,
            },
          }
        : {
            adapter_id: "runtime_subagent",
            supported: false,
            reason: "Official runtime subagent APIs are unavailable in the current plugin runtime",
          };
    },
    async execute(context) {
      const request = context.request;
      const targetSessionKey = buildManagedA2ATargetSessionKey(request.target_agent_id);
      const timeoutMs = resolveRequestTimeoutMs(request.ttl_seconds, request.timeout_seconds);
      const message = buildManagedA2ADelegationMessage(request);
      const auditRef = buildManagedA2AAuditRef(request.request_id);
      let runId: string | undefined;
      let stage: "dispatch" | "wait" | "collect_evidence" = "dispatch";

      try {
        const runResult = asRecord(
          await context.api.runtime.subagent.run({
            sessionKey: targetSessionKey,
            message,
            deliver: false,
            idempotencyKey: request.idempotency_key ?? request.request_id,
          }),
        );

        runId = normalizeString(runResult.runId);
        if (!runId) {
          throw new Error("runtime.subagent.run returned an invalid runId");
        }

        context.auditEvents.push(
          buildManagedA2AAuditEvent({
            stage: "running",
            request_id: request.request_id,
            adapter_id: "runtime_subagent",
            message: "Delegation dispatched and waiting for runtime subagent completion",
            details: {
              run_id: runId,
              target_session_key: targetSessionKey,
            },
          }),
        );

        stage = "wait";
        const wait = await context.api.runtime.subagent.waitForRun({
          runId,
          timeoutMs,
        });

        if (wait.status === "timeout") {
          context.auditEvents.push(
            buildManagedA2AAuditEvent({
              stage: "expired",
              request_id: request.request_id,
              adapter_id: "runtime_subagent",
              message: "Runtime subagent wait timed out",
              details: {
                run_id: runId,
                target_session_key: targetSessionKey,
                timeout_ms: timeoutMs,
              },
            }),
          );

          return buildManagedA2AFailureResult({
            requestId: request.request_id,
            status: "expired",
            error: new ManagedA2AError(
              "timeout",
              "Runtime subagent execution timed out",
              {
                run_id: runId,
                target_session_key: targetSessionKey,
                timeout_ms: timeoutMs,
              },
            ),
            recommendation: "Increase timeout_seconds or inspect the target agent session for stalled execution.",
            auditRef,
          });
        }

        if (wait.status === "error") {
          const waitError = normalizeString(wait.error) ?? "Runtime subagent execution failed";
          context.auditEvents.push(
            buildManagedA2AAuditEvent({
              stage: "failed",
              request_id: request.request_id,
              adapter_id: "runtime_subagent",
              message: waitError,
              details: {
                run_id: runId,
                target_session_key: targetSessionKey,
              },
            }),
          );

          return buildManagedA2AFailureResult({
            requestId: request.request_id,
            status: "failed",
            error: new ManagedA2AError("execution_failed", waitError, {
              run_id: runId,
              target_session_key: targetSessionKey,
            }),
            recommendation: "Inspect the target agent session transcript for the execution error.",
            auditRef,
          });
        }

        stage = "collect_evidence";
        const history = await context.api.runtime.subagent.getSessionMessages({
          sessionKey: targetSessionKey,
          limit: 80,
        });
        const replyText = extractLatestAssistantText(history.messages, request.request_id);

        if (!replyText) {
          context.auditEvents.push(
            buildManagedA2AAuditEvent({
              stage: "failed",
              request_id: request.request_id,
              adapter_id: "runtime_subagent",
              message: "Runtime subagent completed without an extractable assistant reply",
              details: {
                run_id: runId,
                target_session_key: targetSessionKey,
              },
            }),
          );

          return buildManagedA2AFailureResult({
            requestId: request.request_id,
            status: "failed",
            error: new ManagedA2AError(
              "execution_failed",
              "Runtime subagent completed without an extractable assistant reply",
              {
                run_id: runId,
                target_session_key: targetSessionKey,
              },
            ),
            recommendation: "Adjust the target agent prompt or inspect recent session messages manually.",
            auditRef,
          });
        }

        context.auditEvents.push(
          buildManagedA2AAuditEvent({
            stage: "completed",
            request_id: request.request_id,
            adapter_id: "runtime_subagent",
            message: "Delegation completed through runtime subagent transport",
            details: {
              run_id: runId,
              target_session_key: targetSessionKey,
            },
          }),
        );

        return buildSuccessResult({
          requestId: request.request_id,
          targetAgentId: request.target_agent_id,
          targetSessionKey,
          runId,
          text: replyText,
        });
      } catch (error) {
        if (isSubagentRuntimeUnavailableError(error) && context.config.allowCliFallback) {
          const reason = errorMessage(error);
          context.api.logger.warn?.(
            `managed-a2a: runtime_subagent unavailable; falling back to local CLI (request_id=${request.request_id}, reason=${reason})`,
          );
          context.auditEvents.push(
            buildManagedA2AAuditEvent({
              stage: "degraded",
              request_id: request.request_id,
              adapter_id: "cli_fallback",
              message: "Runtime subagent unavailable; switching to local CLI fallback",
              details: {
                reason,
              },
            }),
          );
          return await createCliFallbackAdapter().execute(context);
        }

        const messageText = errorMessage(error);
        const category = isSubagentRuntimeUnavailableError(error)
          ? "compatibility_unsupported"
          : stage === "collect_evidence"
            ? "execution_failed"
            : "transport_failed";

        context.auditEvents.push(
          buildManagedA2AAuditEvent({
            stage: "failed",
            request_id: request.request_id,
            adapter_id: "runtime_subagent",
            message: messageText,
            details: {
              stage,
              ...(runId ? { run_id: runId } : {}),
              target_session_key: targetSessionKey,
            },
          }),
        );

        return buildManagedA2AFailureResult({
          requestId: request.request_id,
          status: "failed",
          error: new ManagedA2AError(category, messageText, {
            stage,
            ...(runId ? { run_id: runId } : {}),
            target_session_key: targetSessionKey,
          }),
          recommendation:
            category === "compatibility_unsupported"
              ? "Use CLI fallback or update the runtime context so official subagent APIs are callable."
              : "Inspect transport logs and the target agent session for more detail.",
          auditRef,
        });
      }
    },
  };
}
