import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import type { ManagedA2AResolvedConfig } from "../config.js";
import { MANAGED_A2A_FEISHU_ADAPTER_ID } from "../constants.js";
import { ManagedA2AError } from "../errors.js";
import type { ManagedA2AExecutionResult, ManagedA2ARequestEnvelope } from "../protocol/types.js";
import {
  asRecord,
  buildManagedA2ADelegationMessage,
  buildManagedA2ATargetSessionKey,
  normalizeString,
} from "../adapters/shared.js";
import type { ManagedA2AChannelAdapter, ManagedA2AChannelAdapterNormalization } from "./types.js";

const DEFAULT_FEISHU_REGISTRY_PATH = path.join(
  os.homedir(),
  ".openclaw",
  "domain-agent",
  "feishu-domain-registry.json",
);

type ManagedA2AFeishuAdapterConfig = ManagedA2AResolvedConfig["channelAdapters"]["feishu"];

type FeishuDomainRegistryRecord = {
  chat_id: string;
  agent_id?: string;
  display_name?: string;
  alias_en?: string;
  enabled?: boolean;
  status?: string;
  domain_type?: string;
  owner?: string;
  notes?: string;
};

type FeishuDomainRegistry = {
  version: number;
  domains: FeishuDomainRegistryRecord[];
};

type FeishuTargetCandidate = {
  agent_id?: string;
  chat_id: string;
  display_name?: string;
  alias_en?: string;
  domain_type?: string;
  status?: string;
  enabled?: boolean;
  owner?: string;
  notes?: string;
};

type FeishuTargetResolution =
  | {
      ok: true;
      targetAgentId: string;
      matchedBy: string;
      candidates: FeishuTargetCandidate[];
    }
  | {
      ok: false;
      error: string;
      candidates: FeishuTargetCandidate[];
    };

type FeishuRouteDecision = "LOCAL_EXECUTE" | "ASK_CLARIFY" | "DELEGATE";

type FeishuAdapterState = {
  matched_by?: string;
  decision: FeishuRouteDecision;
  decision_reason: string;
  requester_agent_id?: string;
  target_agent_id?: string;
  target_session_key?: string;
  visited_agents?: string[];
  timeout_seconds?: number;
  candidates?: FeishuTargetCandidate[];
};

function expandUserPath(value: string): string {
  return value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : value;
}

function resolveFeishuRegistryPath(config: ManagedA2AFeishuAdapterConfig): string {
  const configured = normalizeString(config.registryPath);
  return configured ? path.resolve(expandUserPath(configured)) : DEFAULT_FEISHU_REGISTRY_PATH;
}

function normalizeStringArray(value: unknown, fieldName: string): string[] {
  if (typeof value === "undefined") {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new ManagedA2AError("invalid_request", `${fieldName} must be an array of strings`);
  }
  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (normalized.length !== value.length) {
    throw new ManagedA2AError("invalid_request", `${fieldName} must contain only strings`);
  }
  return [...new Set(normalized)];
}

function readRequiredQuestion(rawParams: Record<string, unknown>): string {
  const question = normalizeString(rawParams.question);
  if (!question) {
    throw new ManagedA2AError("invalid_request", "question must be a non-empty string");
  }
  return question;
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

function resolveFeishuTimeoutSeconds(value: unknown): number {
  if (typeof value === "undefined") {
    return 90;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ManagedA2AError("invalid_request", "timeout_seconds must be an integer when provided");
  }
  return Math.max(5, Math.min(300, value));
}

function ensureRequestId(rawParams: Record<string, unknown>): string {
  const existing = normalizeString(rawParams.request_id);
  return existing ?? `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function normalizeRegistryRecord(raw: unknown): FeishuDomainRegistryRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const chatId = normalizeString(record.chat_id);
  if (!chatId) {
    return null;
  }
  const agentId = normalizeString(record.agent_id);
  const displayName = normalizeString(record.display_name);
  const aliasEn = normalizeString(record.alias_en);
  const domainType = normalizeString(record.domain_type);
  const owner = normalizeString(record.owner);
  const notes = normalizeString(record.notes);
  return {
    chat_id: chatId,
    enabled: typeof record.enabled === "boolean" ? record.enabled : true,
    status: normalizeString(record.status) ?? "active",
    ...(agentId ? { agent_id: agentId } : {}),
    ...(displayName ? { display_name: displayName } : {}),
    ...(aliasEn ? { alias_en: aliasEn } : {}),
    ...(domainType ? { domain_type: domainType } : {}),
    ...(owner ? { owner } : {}),
    ...(notes ? { notes } : {}),
  };
}

async function loadFeishuRegistry(config: ManagedA2AFeishuAdapterConfig): Promise<FeishuDomainRegistry> {
  const registryPath = resolveFeishuRegistryPath(config);
  try {
    const raw = await fs.readFile(registryPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown; domains?: unknown };
    const domains = Array.isArray(parsed.domains)
      ? parsed.domains
          .map((record) => normalizeRegistryRecord(record))
          .filter((record): record is FeishuDomainRegistryRecord => Boolean(record))
      : [];
    return {
      version:
        typeof parsed.version === "number" && Number.isFinite(parsed.version)
          ? Math.max(1, Math.floor(parsed.version))
          : 2,
      domains,
    };
  } catch {
    return {
      version: 2,
      domains: [],
    };
  }
}

function toCandidate(record: FeishuDomainRegistryRecord): FeishuTargetCandidate {
  return {
    chat_id: record.chat_id,
    ...(record.agent_id ? { agent_id: record.agent_id } : {}),
    ...(record.display_name ? { display_name: record.display_name } : {}),
    ...(record.alias_en ? { alias_en: record.alias_en } : {}),
    ...(record.domain_type ? { domain_type: record.domain_type } : {}),
    ...(record.status ? { status: record.status } : {}),
    ...(typeof record.enabled === "boolean" ? { enabled: record.enabled } : {}),
    ...(record.owner ? { owner: record.owner } : {}),
    ...(record.notes ? { notes: record.notes } : {}),
  };
}

function normalizeLower(value: unknown): string {
  return (normalizeString(value) ?? "").toLowerCase();
}

function scoreTargetMatch(record: FeishuDomainRegistryRecord, query: string): number {
  const q = query.toLowerCase();
  const agentId = normalizeLower(record.agent_id);
  const chatId = normalizeLower(record.chat_id);
  const domainType = normalizeLower(record.domain_type);
  const displayName = normalizeLower(record.display_name);
  const aliasEn = normalizeLower(record.alias_en);
  const owner = normalizeLower(record.owner);
  const notes = normalizeLower(record.notes);

  if (agentId && q === agentId) return 120;
  if (chatId && q === chatId) return 118;
  if (displayName && q === displayName) return 116;
  if (aliasEn && q === aliasEn) return 114;
  if (domainType && q === domainType) return 110;

  if (agentId && agentId.includes(q)) return 90;
  if (displayName && displayName.includes(q)) return 88;
  if (aliasEn && aliasEn.includes(q)) return 86;
  if (domainType && domainType.includes(q)) return 80;
  if (owner && owner.includes(q)) return 70;
  if (notes && notes.includes(q)) return 65;
  if (chatId && chatId.includes(q)) return 60;

  if (agentId && q.includes(agentId)) return 55;
  if (displayName && q.includes(displayName)) return 54;
  if (aliasEn && q.includes(aliasEn)) return 53;
  if (domainType && q.includes(domainType)) return 50;
  return 0;
}

function resolveTarget(params: {
  targetAgentId?: string;
  targetChatId?: string;
  targetHint?: string;
  registry: FeishuDomainRegistry;
}): FeishuTargetResolution {
  const activeRecords = params.registry.domains.filter((record) => {
    return Boolean(record.agent_id) && record.enabled !== false && record.status !== "disabled";
  });
  const candidates = activeRecords.map((record) => toCandidate(record));

  const explicitAgentId = normalizeString(params.targetAgentId);
  if (explicitAgentId) {
    const match = activeRecords.find((record) => record.agent_id === explicitAgentId);
    if (!match) {
      return {
        ok: false,
        error: `target_agent_id not found in active domain registry: ${explicitAgentId}`,
        candidates,
      };
    }
    return {
      ok: true,
      targetAgentId: explicitAgentId,
      matchedBy: "target_agent_id",
      candidates,
    };
  }

  const explicitChatId = normalizeString(params.targetChatId);
  if (explicitChatId) {
    const match = activeRecords.find((record) => record.chat_id === explicitChatId);
    if (!match || !match.agent_id) {
      return {
        ok: false,
        error: `target_chat_id not found in active domain registry: ${explicitChatId}`,
        candidates,
      };
    }
    return {
      ok: true,
      targetAgentId: match.agent_id,
      matchedBy: "target_chat_id",
      candidates,
    };
  }

  const targetHint = normalizeString(params.targetHint);
  if (!targetHint) {
    return {
      ok: false,
      error: "One of target_agent_id / target_chat_id / target is required.",
      candidates,
    };
  }

  const scored = activeRecords
    .map((record) => ({ record, score: scoreTargetMatch(record, targetHint) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  if (!best?.record.agent_id) {
    return {
      ok: false,
      error: `Unable to resolve target from hint: ${targetHint}`,
      candidates,
    };
  }

  return {
    ok: true,
    targetAgentId: best.record.agent_id,
    matchedBy: "target_fuzzy",
    candidates,
  };
}

function findRequesterAgentId(registry: FeishuDomainRegistry, chatId?: string): string | undefined {
  const normalizedChatId = normalizeString(chatId);
  if (!normalizedChatId) {
    return undefined;
  }
  return registry.domains.find((record) => record.chat_id === normalizedChatId)?.agent_id;
}

function decideRoute(params: {
  requesterAgentId: string;
  targetAgentId: string;
  question: string;
  hadExplicitTarget: boolean;
}): { decision: FeishuRouteDecision; reason: string } {
  if (!params.hadExplicitTarget) {
    return { decision: "ASK_CLARIFY", reason: "missing_target" };
  }
  if (params.requesterAgentId === params.targetAgentId) {
    return { decision: "LOCAL_EXECUTE", reason: "same_domain_no_delegate" };
  }
  if (params.question.trim().length < 6) {
    return { decision: "ASK_CLARIFY", reason: "question_too_short" };
  }
  return { decision: "DELEGATE", reason: "cross_domain_delegation" };
}

function buildClarifyPayload(params: {
  requestId: string;
  targetAgentId?: string;
  visitedAgents?: string[];
  decision: FeishuRouteDecision;
  decisionReason: string;
  message: string;
  candidates?: FeishuTargetCandidate[];
}): Record<string, unknown> {
  return {
    status: params.decision === "LOCAL_EXECUTE" ? "local_execute" : "ask_clarify",
    decision: params.decision,
    decision_reason: params.decisionReason,
    request_id: params.requestId,
    ...(params.targetAgentId ? { target_agent_id: params.targetAgentId } : {}),
    ...(params.visitedAgents ? { visited_agents: params.visitedAgents } : {}),
    message: params.message,
    ...(params.candidates ? { candidates: params.candidates } : {}),
  };
}

function buildDryRunPayload(params: {
  request: ManagedA2ARequestEnvelope;
  state: FeishuAdapterState;
}): Record<string, unknown> {
  return {
    status: "dry_run",
    mode: "orchestrated_internal",
    matched_by: params.state.matched_by,
    requester_agent_id: params.request.requester_agent_id,
    target_agent_id: params.request.target_agent_id,
    target_session_key: params.state.target_session_key,
    delivery: {
      deliver: false,
      channel: "internal",
    },
    timeout_seconds: params.state.timeout_seconds,
    request_id: params.request.request_id,
    decision: params.state.decision,
    decision_reason: params.state.decision_reason,
    visited_agents: params.request.visited_agents,
    message_preview: buildManagedA2ADelegationMessage(params.request),
    ...(params.state.candidates ? { candidates: params.state.candidates } : {}),
  };
}

function mapFailureCode(error: ManagedA2AError): string {
  if (error.category === "timeout") {
    return "COLLAB_TIMEOUT";
  }
  if (error.category === "resolution_failed") {
    return "RESOLUTION_FAILED";
  }
  if (error.category === "transport_unavailable") {
    return "TRANSPORT_UNAVAILABLE";
  }
  if (error.category === "transport_failed") {
    return "TRANSPORT_FAILED";
  }
  if (
    error.category === "policy_denied" &&
    /visited_agents/i.test(error.message)
  ) {
    return "LOOP_DETECTED";
  }
  if (
    error.category === "policy_denied" &&
    /disabled by configuration/i.test(error.message)
  ) {
    return "PLUGIN_DISABLED";
  }
  if (error.category === "invalid_request") {
    return "INVALID_REQUEST";
  }
  return "TARGET_EXEC_ERROR";
}

function mapManagedErrorToCompatPayload(params: {
  requestId: string;
  error: ManagedA2AError;
  state?: Record<string, unknown>;
  request?: ManagedA2ARequestEnvelope;
}): Record<string, unknown> {
  const state = params.state as FeishuAdapterState | undefined;
  const request = params.request;
  const errorCode = mapFailureCode(params.error);
  const status =
    params.error.category === "timeout"
      ? "timeout"
      : params.error.category === "policy_denied"
        ? "rejected"
        : "error";

  return {
    status,
    request_id: params.requestId,
    ...(request?.target_agent_id
      ? { target_agent_id: request.target_agent_id }
      : state?.target_agent_id
        ? { target_agent_id: state.target_agent_id }
        : {}),
    ...(state?.target_session_key ? { target_session_key: state.target_session_key } : {}),
    ...(request?.visited_agents ? { visited_agents: request.visited_agents } : {}),
    error_code: errorCode,
    error: params.error.message,
    diagnostics: {
      category: params.error.category,
      reason: params.error.message,
      ...(params.error.details ? { details: params.error.details } : {}),
    },
  };
}

function mapCoreResultToCompatPayload(params: {
  result: ManagedA2AExecutionResult;
  request: ManagedA2ARequestEnvelope;
  state?: Record<string, unknown>;
}): Record<string, unknown> {
  const state = params.state as FeishuAdapterState | undefined;
  if (params.result.error) {
    return mapManagedErrorToCompatPayload({
      requestId: params.result.request_id,
      error: new ManagedA2AError(
        params.result.error.category,
        params.result.error.message,
        params.result.error.details,
      ),
      ...(params.state ? { state: params.state } : {}),
      request: params.request,
    });
  }

  const evidence = asRecord(params.result.evidence);
  const reply = normalizeString(evidence.text) ?? normalizeString(evidence.raw_text) ?? "";

  return {
    status: "ok",
    managed_status: params.result.status,
    mode: "orchestrated_internal",
    matched_by: state?.matched_by,
    requester_agent_id: params.request.requester_agent_id,
    target_agent_id: params.request.target_agent_id,
    target_session_key:
      normalizeString(evidence.target_session_key) ?? state?.target_session_key,
    run_id: normalizeString(evidence.run_id),
    request_id: params.result.request_id,
    decision: state?.decision ?? "DELEGATE",
    decision_reason: state?.decision_reason ?? "cross_domain_delegation",
    visited_agents: params.request.visited_agents,
    publish_allowed: false,
    delivery: {
      deliver: false,
      channel: "internal",
    },
    reply,
    ...(params.result.recommendation ? { recommendation: params.result.recommendation } : {}),
    ...(params.result.diagnostics ? { diagnostics: params.result.diagnostics } : {}),
    ...(params.result.audit_ref ? { audit_ref: params.result.audit_ref } : {}),
  };
}

export function createManagedA2AFeishuAdapter(
  adapterConfig: ManagedA2AFeishuAdapterConfig,
): ManagedA2AChannelAdapter {
  return {
    id: MANAGED_A2A_FEISHU_ADAPTER_ID,
    toolName: adapterConfig.toolName,
    label: "Managed A2A Feishu Delegate",
    description:
      "Reference Feishu/domain adapter that resolves channel-native domain-agent inputs into the managed-a2a core delegation contract.",
    parameters: Type.Object(
      {
        target_agent_id: Type.Optional(Type.String()),
        target_chat_id: Type.Optional(Type.String()),
        target: Type.Optional(Type.String()),
        requester_agent_id: Type.Optional(Type.String()),
        chat_id: Type.Optional(Type.String()),
        question: Type.String(),
        timeout_seconds: Type.Optional(Type.Integer({ minimum: 5, maximum: 300, default: 90 })),
        account_id: Type.Optional(Type.String()),
        dry_run: Type.Optional(Type.Boolean({ default: false })),
        request_id: Type.Optional(Type.String()),
        visited_agents: Type.Optional(Type.Array(Type.String())),
      },
      { additionalProperties: false },
    ),
    async normalize({ rawParams, config }): Promise<ManagedA2AChannelAdapterNormalization> {
      const requestId = ensureRequestId(rawParams);
      const question = readRequiredQuestion(rawParams);
      const registry = await loadFeishuRegistry(adapterConfig);
      const targetAgentId = normalizeString(rawParams.target_agent_id);
      const targetChatId = normalizeString(rawParams.target_chat_id);
      const targetHint = normalizeString(rawParams.target);
      const hadExplicitTarget = Boolean(
        targetAgentId ||
          targetChatId ||
          targetHint,
      );
      const target = resolveTarget({
        registry,
        ...(targetAgentId ? { targetAgentId } : {}),
        ...(targetChatId ? { targetChatId } : {}),
        ...(targetHint ? { targetHint } : {}),
      });

      if (!target.ok) {
        return {
          kind: "terminal",
          payload: {
            status: "ask_clarify",
            decision: "ASK_CLARIFY",
            decision_reason: "target_unresolved",
            request_id: requestId,
            error: target.error,
            candidates: target.candidates,
          },
        };
      }

      const sourceChatId = normalizeString(rawParams.chat_id);
      const requesterAgentId =
        normalizeString(rawParams.requester_agent_id) ??
        findRequesterAgentId(registry, sourceChatId);
      if (!requesterAgentId) {
        throw new ManagedA2AError(
          "resolution_failed",
          "Unable to resolve requester_agent_id from input or chat_id",
          {
            chat_id: sourceChatId,
            registry_path: resolveFeishuRegistryPath(adapterConfig),
          },
        );
      }

      const decision = decideRoute({
        requesterAgentId,
        targetAgentId: target.targetAgentId,
        question,
        hadExplicitTarget,
      });
      const visitedAgents = Array.from(
        new Set([...normalizeStringArray(rawParams.visited_agents, "visited_agents"), requesterAgentId]),
      );

      if (decision.decision !== "DELEGATE") {
        return {
          kind: "terminal",
          payload: buildClarifyPayload({
            requestId,
            targetAgentId: target.targetAgentId,
            visitedAgents,
            decision: decision.decision,
            decisionReason: decision.reason,
            message:
              decision.decision === "LOCAL_EXECUTE"
                ? "Target equals requester. Keep execution in current domain."
                : "Need clearer task context before delegation.",
            candidates: target.candidates,
          }),
        };
      }

      const timeoutSeconds = resolveFeishuTimeoutSeconds(rawParams.timeout_seconds);
      const normalizedRequest: Record<string, unknown> = {
        request_id: requestId,
        requester_agent_id: requesterAgentId,
        target_agent_id: target.targetAgentId,
        question,
        mode: "orchestrated_internal",
        ttl_seconds: timeoutSeconds,
        hop: 1,
        visited_agents: visitedAgents,
        publish_contract: "evidence_only",
        external_announce: "forbidden",
        timeout_seconds: timeoutSeconds,
        ...(sourceChatId ? { source_chat_id: sourceChatId } : {}),
        metadata: {
          channel_adapter: MANAGED_A2A_FEISHU_ADAPTER_ID,
          source_chat_id: sourceChatId,
          target_match: target.matchedBy,
          ...(targetChatId ? { target_chat_id: targetChatId } : {}),
          ...(targetHint ? { target_hint: targetHint } : {}),
          ...(normalizeString(rawParams.account_id)
            ? { account_id: normalizeString(rawParams.account_id) }
            : {}),
        },
      };

      const state: FeishuAdapterState = {
        matched_by: target.matchedBy,
        decision: decision.decision,
        decision_reason: decision.reason,
        requester_agent_id: requesterAgentId,
        target_agent_id: target.targetAgentId,
        target_session_key: buildManagedA2ATargetSessionKey(target.targetAgentId),
        visited_agents: visitedAgents,
        timeout_seconds: timeoutSeconds,
        candidates: target.candidates,
      };

      if (readOptionalBoolean(rawParams, "dry_run")) {
        return {
          kind: "terminal",
          payload: buildDryRunPayload({
            request: normalizedRequest as ManagedA2ARequestEnvelope,
            state,
          }),
        };
      }

      return {
        kind: "delegate",
        request: normalizedRequest,
        state,
      };
    },
    mapResult({ result, request, state }) {
      return mapCoreResultToCompatPayload({
        result,
        request,
        ...(state ? { state } : {}),
      });
    },
    mapError({ requestId, error, request, state }) {
      return mapManagedErrorToCompatPayload({
        requestId,
        error,
        ...(request ? { request } : {}),
        ...(state ? { state } : {}),
      });
    },
  };
}
