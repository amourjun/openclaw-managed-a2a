import type { ManagedA2AResolvedConfig } from "../config.js";
import { ManagedA2AError } from "../errors.js";
import type { ManagedA2ARequestEnvelope } from "../protocol/types.js";

function readRequiredString(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ManagedA2AError("invalid_request", `${key} must be a non-empty string`);
  }
  return value.trim();
}

function readOptionalString(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function readPositiveInteger(
  params: Record<string, unknown>,
  key: string,
  fallback?: number,
): number {
  const value = params[key];
  if (typeof value === "undefined") {
    if (typeof fallback === "number") {
      return fallback;
    }
    throw new ManagedA2AError("invalid_request", `${key} is required`);
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ManagedA2AError("invalid_request", `${key} must be a positive integer`);
  }
  return value;
}

function normalizeVisitedAgents(params: Record<string, unknown>): string[] {
  const value = params.visited_agents;
  if (!Array.isArray(value)) {
    throw new ManagedA2AError("invalid_request", "visited_agents must be an array of strings");
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (normalized.length !== value.length) {
    throw new ManagedA2AError("invalid_request", "visited_agents must contain only strings");
  }

  return [...new Set(normalized)];
}

function normalizeMetadata(params: Record<string, unknown>): Record<string, unknown> | undefined {
  const value = params.metadata;
  if (typeof value === "undefined") {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ManagedA2AError("invalid_request", "metadata must be an object when provided");
  }
  return value as Record<string, unknown>;
}

export function parseManagedA2ARequest(
  params: Record<string, unknown>,
  config: ManagedA2AResolvedConfig,
): ManagedA2ARequestEnvelope {
  const request_id = readRequiredString(params, "request_id");
  const requester_agent_id = readRequiredString(params, "requester_agent_id");
  const target_agent_id = readRequiredString(params, "target_agent_id");
  const question = readRequiredString(params, "question");
  const mode = readRequiredString(params, "mode");
  const publish_contract = readRequiredString(params, "publish_contract");
  const external_announce = readRequiredString(params, "external_announce");
  const ttl_seconds = readPositiveInteger(params, "ttl_seconds", config.defaultTtlSeconds);
  const hop = readPositiveInteger(params, "hop");
  const visited_agents = normalizeVisitedAgents(params);
  const timeout_seconds = readPositiveInteger(
    params,
    "timeout_seconds",
    config.defaultTimeoutSeconds,
  );
  const source_chat_id = readOptionalString(params, "source_chat_id");
  const idempotency_key = readOptionalString(params, "idempotency_key");
  const metadata = normalizeMetadata(params);

  if (mode !== "orchestrated_internal") {
    throw new ManagedA2AError("invalid_request", "mode must be orchestrated_internal");
  }

  if (publish_contract !== "evidence_only") {
    throw new ManagedA2AError("policy_denied", "publish_contract must be evidence_only in v1");
  }

  if (external_announce !== "forbidden" && external_announce !== "allowed") {
    throw new ManagedA2AError(
      "invalid_request",
      "external_announce must be forbidden or allowed",
    );
  }

  if (ttl_seconds > config.maxTtlSeconds) {
    throw new ManagedA2AError("invalid_request", "ttl_seconds exceeds configured maxTtlSeconds", {
      ttl_seconds,
      max_ttl_seconds: config.maxTtlSeconds,
    });
  }

  if (timeout_seconds > ttl_seconds) {
    throw new ManagedA2AError(
      "invalid_request",
      "timeout_seconds must not exceed ttl_seconds",
      { timeout_seconds, ttl_seconds },
    );
  }

  if (visited_agents.includes(target_agent_id)) {
    throw new ManagedA2AError(
      "policy_denied",
      "target_agent_id already appears in visited_agents",
      { target_agent_id, visited_agents },
    );
  }

  return {
    request_id,
    requester_agent_id,
    target_agent_id,
    question,
    mode: "orchestrated_internal",
    ttl_seconds,
    hop,
    visited_agents,
    publish_contract: "evidence_only",
    external_announce: external_announce as "forbidden" | "allowed",
    ...(source_chat_id ? { source_chat_id } : {}),
    ...(timeout_seconds ? { timeout_seconds } : {}),
    ...(idempotency_key ? { idempotency_key } : {}),
    ...(metadata ? { metadata } : {}),
  };
}
