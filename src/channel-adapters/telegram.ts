import crypto from "node:crypto";
import { Type } from "@sinclair/typebox";
import type { ManagedA2AResolvedConfig } from "../config.js";
import { MANAGED_A2A_TELEGRAM_ADAPTER_ID } from "../constants.js";
import { ManagedA2AError } from "../errors.js";
import { buildManagedA2ATargetSessionKey, normalizeString } from "../adapters/shared.js";
import type { ManagedA2AExecutionResult, ManagedA2ARequestEnvelope } from "../protocol/types.js";
import type { ManagedA2AChannelAdapter } from "./types.js";

type ManagedA2ATelegramAdapterConfig = ManagedA2AResolvedConfig["channelAdapters"]["telegram"];

function ensureRequestId(rawParams: Record<string, unknown>): string {
  const existing = normalizeString(rawParams.request_id);
  return existing ?? `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function readRequiredString(rawParams: Record<string, unknown>, key: string): string {
  const value = normalizeString(rawParams[key]);
  if (!value) {
    throw new ManagedA2AError("invalid_request", `${key} must be a non-empty string`);
  }
  return value;
}

function readTargetAgentId(rawParams: Record<string, unknown>): string {
  const targetAgentId =
    normalizeString(rawParams.target_agent_id) ??
    normalizeString(rawParams.target) ??
    normalizeString(rawParams.target_handle);
  if (!targetAgentId) {
    throw new ManagedA2AError(
      "resolution_failed",
      "target_agent_id (or target/target_handle) is required",
    );
  }
  return targetAgentId;
}

function readOptionalPositiveInteger(
  rawParams: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = rawParams[key];
  if (typeof value === "undefined") {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ManagedA2AError("invalid_request", `${key} must be a positive integer when provided`);
  }
  return value;
}

function readOptionalBoolean(rawParams: Record<string, unknown>, key: string): boolean {
  const value = rawParams[key];
  if (typeof value === "undefined") {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new ManagedA2AError("invalid_request", `${key} must be a boolean when provided`);
  }
  return value;
}

function readOptionalStringArray(rawParams: Record<string, unknown>, key: string): string[] | undefined {
  const value = rawParams[key];
  if (typeof value === "undefined") {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new ManagedA2AError("invalid_request", `${key} must be an array of strings`);
  }
  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (normalized.length !== value.length) {
    throw new ManagedA2AError("invalid_request", `${key} must contain only strings`);
  }
  return [...new Set(normalized)];
}

function readOptionalMetadata(rawParams: Record<string, unknown>): Record<string, unknown> | undefined {
  const metadata = rawParams.metadata;
  if (typeof metadata === "undefined") {
    return undefined;
  }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new ManagedA2AError("invalid_request", "metadata must be an object when provided");
  }
  return metadata as Record<string, unknown>;
}

function mapErrorCode(category: string): string {
  switch (category) {
    case "resolution_failed":
      return "RESOLUTION_FAILED";
    case "policy_denied":
      return "POLICY_DENIED";
    case "transport_unavailable":
      return "TRANSPORT_UNAVAILABLE";
    case "transport_failed":
      return "TRANSPORT_FAILED";
    case "timeout":
      return "TIMEOUT";
    case "compatibility_unsupported":
      return "COMPATIBILITY_UNSUPPORTED";
    case "invalid_request":
      return "INVALID_REQUEST";
    default:
      return "EXECUTION_FAILED";
  }
}

function mapResultStatus(result: ManagedA2AExecutionResult): "ok" | "rejected" | "error" {
  if (result.status === "completed" || result.status === "degraded") {
    return "ok";
  }
  if (result.status === "rejected" || result.status === "expired") {
    return "rejected";
  }
  return "error";
}

export function createManagedA2ATelegramAdapter(
  adapterConfig: ManagedA2ATelegramAdapterConfig,
): ManagedA2AChannelAdapter {
  return {
    id: MANAGED_A2A_TELEGRAM_ADAPTER_ID,
    toolName: adapterConfig.toolName,
    label: "Managed A2A Telegram Delegate",
    description:
      "Telegram-facing compatibility wrapper that normalizes telegram-style request fields into the canonical managed_a2a_delegate request contract.",
    parameters: Type.Object({
      request_id: Type.Optional(Type.String()),
      requester_agent_id: Type.String(),
      target_agent_id: Type.Optional(Type.String()),
      target: Type.Optional(Type.String()),
      target_handle: Type.Optional(Type.String()),
      question: Type.String(),
      chat_id: Type.Optional(Type.String()),
      source_chat_id: Type.Optional(Type.String()),
      timeout_seconds: Type.Optional(Type.Integer({ minimum: 1 })),
      ttl_seconds: Type.Optional(Type.Integer({ minimum: 1 })),
      hop: Type.Optional(Type.Integer({ minimum: 1 })),
      visited_agents: Type.Optional(Type.Array(Type.String())),
      metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
      dry_run: Type.Optional(Type.Boolean()),
      allow_external_announce: Type.Optional(Type.Boolean()),
    }),
    normalize(params) {
      const requestId = ensureRequestId(params.rawParams);
      const requesterAgentId = readRequiredString(params.rawParams, "requester_agent_id");
      const targetAgentId = readTargetAgentId(params.rawParams);
      const question = readRequiredString(params.rawParams, "question");
      const timeoutSeconds = readOptionalPositiveInteger(params.rawParams, "timeout_seconds");
      const ttlSeconds = readOptionalPositiveInteger(params.rawParams, "ttl_seconds");
      const hop = readOptionalPositiveInteger(params.rawParams, "hop") ?? 1;
      const allowExternalAnnounce = readOptionalBoolean(params.rawParams, "allow_external_announce");
      const dryRun = readOptionalBoolean(params.rawParams, "dry_run");
      const sourceChatId =
        normalizeString(params.rawParams.chat_id) ?? normalizeString(params.rawParams.source_chat_id);
      const visitedAgents = readOptionalStringArray(params.rawParams, "visited_agents");
      const metadataInput = readOptionalMetadata(params.rawParams) ?? {};
      const metadata = {
        ...metadataInput,
        source_channel: "telegram",
      };
      const normalizedRequest: Record<string, unknown> = {
        request_id: requestId,
        requester_agent_id: requesterAgentId,
        target_agent_id: targetAgentId,
        question,
        mode: "orchestrated_internal",
        publish_contract: "evidence_only",
        external_announce: allowExternalAnnounce ? "allowed" : "forbidden",
        hop,
        visited_agents: visitedAgents ?? [requesterAgentId],
        metadata,
        ...(sourceChatId ? { source_chat_id: sourceChatId } : {}),
        ...(timeoutSeconds ? { timeout_seconds: timeoutSeconds } : {}),
        ...(ttlSeconds ? { ttl_seconds: ttlSeconds } : {}),
      };

      if (dryRun) {
        return {
          kind: "terminal" as const,
          payload: {
            status: "dry_run",
            request_id: requestId,
            source_channel: "telegram",
            requester_agent_id: requesterAgentId,
            target_agent_id: targetAgentId,
            target_session_key: buildManagedA2ATargetSessionKey(targetAgentId),
            normalized_request: normalizedRequest,
          },
        };
      }

      return {
        kind: "delegate" as const,
        request: normalizedRequest,
        state: {
          source_channel: "telegram",
          requester_agent_id: requesterAgentId,
          target_agent_id: targetAgentId,
          ...(sourceChatId ? { source_chat_id: sourceChatId } : {}),
        },
      };
    },
    mapResult(params) {
      return {
        status: mapResultStatus(params.result),
        managed_status: params.result.status,
        request_id: params.request.request_id,
        source_channel: "telegram",
        requester_agent_id: params.request.requester_agent_id,
        target_agent_id: params.request.target_agent_id,
        target_session_key: buildManagedA2ATargetSessionKey(params.request.target_agent_id),
        recommendation: params.result.recommendation ?? null,
        evidence: params.result.evidence ?? null,
        diagnostics: params.result.diagnostics ?? null,
        audit_ref: params.result.audit_ref ?? null,
        error: params.result.error ?? null,
        ...(params.request.source_chat_id ? { source_chat_id: params.request.source_chat_id } : {}),
      };
    },
    mapError(params) {
      return {
        status: params.error.category === "policy_denied" ? "rejected" : "error",
        request_id: params.requestId,
        source_channel: "telegram",
        error_code: mapErrorCode(params.error.category),
        error_message: params.error.message,
        diagnostics: {
          category: params.error.category,
          ...(params.error.details ? { details: params.error.details } : {}),
        },
        ...(params.state ? params.state : {}),
      };
    },
  };
}
