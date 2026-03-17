import { buildManagedA2AAuditEvent, buildManagedA2AAuditRef } from "../audit/types.js";
import { ManagedA2AError, buildManagedA2AFailureResult } from "../errors.js";
import type { ManagedA2ATransportAdapter } from "./types.js";
import {
  buildManagedA2ADelegationMessage,
  errorMessage,
  extractTextFromCliPayloads,
  parseCliJsonOutput,
  parseManagedA2ATextReply,
} from "./shared.js";

function resolveRequestTimeoutMs(ttlSeconds: number, timeoutSeconds?: number): number {
  return Math.max(1000, (timeoutSeconds ?? ttlSeconds) * 1000);
}

export function createCliFallbackAdapter(): ManagedA2ATransportAdapter {
  return {
    id: "cli_fallback",
    label: "CLI Fallback",
    async probe(context) {
      return typeof context.api.runtime?.system?.runCommandWithTimeout === "function"
        ? {
            adapter_id: "cli_fallback",
            supported: true,
            reason: "Local CLI fallback is available through runtime.system.runCommandWithTimeout",
            details: {
              cli_path: process.env.OPENCLAW_CLI_PATH?.trim() || "openclaw",
            },
          }
        : {
            adapter_id: "cli_fallback",
            supported: false,
            reason: "runtime.system.runCommandWithTimeout is unavailable for CLI fallback",
          };
    },
    async execute(context) {
      const request = context.request;
      const cliPath = process.env.OPENCLAW_CLI_PATH?.trim() || "openclaw";
      const timeoutMs = resolveRequestTimeoutMs(request.ttl_seconds, request.timeout_seconds);
      const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
      const auditRef = buildManagedA2AAuditRef(request.request_id);
      const argv = [
        cliPath,
        "agent",
        "--local",
        "--json",
        "--agent",
        request.target_agent_id,
        "--message",
        buildManagedA2ADelegationMessage(request),
        "--timeout",
        String(timeoutSeconds),
      ];

      try {
        const commandResult = await context.api.runtime.system.runCommandWithTimeout(argv, {
          timeoutMs: timeoutMs + 1000,
        });

        if (commandResult.termination === "timeout") {
          context.auditEvents.push(
            buildManagedA2AAuditEvent({
              stage: "expired",
              request_id: request.request_id,
              adapter_id: "cli_fallback",
              message: "Local CLI fallback timed out",
              details: {
                cli_path: cliPath,
                timeout_ms: timeoutMs,
              },
            }),
          );
          return buildManagedA2AFailureResult({
            requestId: request.request_id,
            status: "expired",
            error: new ManagedA2AError("timeout", "Local CLI fallback timed out", {
              cli_path: cliPath,
              timeout_ms: timeoutMs,
            }),
            recommendation: "Increase timeout_seconds or inspect the local CLI execution environment.",
            auditRef,
          });
        }

        const parsed = parseCliJsonOutput(commandResult.stdout);
        const replyText = extractTextFromCliPayloads(parsed.payloads, request.request_id);

        if (!replyText) {
          context.auditEvents.push(
            buildManagedA2AAuditEvent({
              stage: "failed",
              request_id: request.request_id,
              adapter_id: "cli_fallback",
              message: "Local CLI fallback completed without an extractable text payload",
              details: {
                cli_path: cliPath,
                exit_code: commandResult.code,
              },
            }),
          );
          return buildManagedA2AFailureResult({
            requestId: request.request_id,
            status: "failed",
            error: new ManagedA2AError(
              "execution_failed",
              "Local CLI fallback completed without an extractable text payload",
              {
                cli_path: cliPath,
                exit_code: commandResult.code,
              },
            ),
            recommendation: "Inspect the local CLI JSON payloads to confirm the target agent emitted text output.",
            auditRef,
          });
        }

        const parsedReply = parseManagedA2ATextReply(replyText, request.request_id);
        context.auditEvents.push(
          buildManagedA2AAuditEvent({
            stage: "completed",
            request_id: request.request_id,
            adapter_id: "cli_fallback",
            message: "Delegation completed through local CLI fallback",
            details: {
              cli_path: cliPath,
              exit_code: commandResult.code,
            },
          }),
        );
        return {
          request_id: request.request_id,
          status: "degraded",
          evidence: {
            target_agent_id: request.target_agent_id,
            cli_path: cliPath,
            text: parsedReply.evidence_text ?? parsedReply.raw_text,
            raw_text: parsedReply.raw_text,
            response_marker_matched: parsedReply.response_marker_matched,
            raw_payload: parsed,
          },
          ...(parsedReply.recommendation ? { recommendation: parsedReply.recommendation } : {}),
          diagnostics: {
            adapter_id: "cli_fallback",
            reason: "Delegation completed through local CLI fallback",
            details: {
              cli_path: cliPath,
              exit_code: commandResult.code,
              response_marker_matched: parsedReply.response_marker_matched,
            },
          },
          audit_ref: auditRef,
        };
      } catch (error) {
        context.auditEvents.push(
          buildManagedA2AAuditEvent({
            stage: "failed",
            request_id: request.request_id,
            adapter_id: "cli_fallback",
            message: errorMessage(error),
            details: {
              cli_path: cliPath,
            },
          }),
        );
        return buildManagedA2AFailureResult({
          requestId: request.request_id,
          status: "failed",
          error: new ManagedA2AError("transport_failed", errorMessage(error), {
            cli_path: cliPath,
          }),
          recommendation: "Verify the local openclaw CLI is installed and callable from the plugin runtime.",
          auditRef,
        });
      }
    },
  };
}
