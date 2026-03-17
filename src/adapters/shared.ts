import type { ManagedA2ARequestEnvelope } from "../protocol/types.js";

const MANAGED_A2A_RESPONSE_MARKER_PREFIX = "MANAGED_A2A_REQUEST_ID:";
const SUBAGENT_RUNTIME_UNAVAILABLE_PATTERNS = [
  /subagent methods are only available during a gateway request/i,
  /subagent dispatch requires a gateway request scope/i,
];

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isSubagentRuntimeUnavailableError(error: unknown): boolean {
  const text = errorMessage(error);
  return SUBAGENT_RUNTIME_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(text));
}

export function buildManagedA2ATargetSessionKey(targetAgentId: string): string {
  return `agent:${targetAgentId}:main`;
}

export function buildManagedA2ADelegationMessage(request: ManagedA2ARequestEnvelope): string {
  const marker = `${MANAGED_A2A_RESPONSE_MARKER_PREFIX} ${request.request_id}`;
  const headerLines = [
    "[Managed A2A Delegation]",
    `request_id=${request.request_id}`,
    `requester_agent_id=${request.requester_agent_id}`,
    `target_agent_id=${request.target_agent_id}`,
    `mode=${request.mode}`,
    `ttl_seconds=${request.ttl_seconds}`,
    `hop=${request.hop}`,
    `visited_agents=${request.visited_agents.join(",")}`,
    `publish_contract=${request.publish_contract}`,
    `external_announce=${request.external_announce}`,
  ];

  if (request.source_chat_id) {
    headerLines.push(`source_chat_id=${request.source_chat_id}`);
  }

  return [
    ...headerLines,
    "",
    "Return plain text only, using exactly this shape:",
    marker,
    "Evidence:",
    "<your evidence>",
    "",
    "Recommendation:",
    "<your recommendation>",
    "",
    "Question:",
    request.question,
  ].join("\n");
}

function extractTextFragments(value: unknown): string[] {
  if (typeof value === "string") {
    const normalized = normalizeString(value);
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractTextFragments(item));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const record = asRecord(value);
  const directKeys = ["text", "message", "value"];
  const nestedKeys = ["content", "payloads", "parts", "segments"];
  const fragments: string[] = [];

  for (const key of directKeys) {
    const text = normalizeString(record[key]);
    if (text) {
      fragments.push(text);
    }
  }

  for (const key of nestedKeys) {
    fragments.push(...extractTextFragments(record[key]));
  }

  return fragments;
}

function mergeFragments(value: unknown): string | undefined {
  const merged = extractTextFragments(value).join("\n").trim();
  return merged || undefined;
}

export function extractLatestAssistantText(
  messages: unknown,
  requestId?: string,
): string | undefined {
  if (!Array.isArray(messages)) {
    return undefined;
  }

  const marker = requestId
    ? `${MANAGED_A2A_RESPONSE_MARKER_PREFIX} ${requestId}`
    : undefined;
  let fallback: string | undefined;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = asRecord(messages[index]);
    const role = normalizeString(message.role) ?? normalizeString(message.author);
    if (role !== "assistant") {
      continue;
    }

    const text = mergeFragments(message);
    if (!text) {
      continue;
    }

    if (marker && text.includes(marker)) {
      return text;
    }

    fallback ??= text;
  }

  return fallback;
}

export function extractTextFromCliPayloads(
  payloads: unknown,
  requestId?: string,
): string | undefined {
  if (!Array.isArray(payloads)) {
    return undefined;
  }

  const marker = requestId
    ? `${MANAGED_A2A_RESPONSE_MARKER_PREFIX} ${requestId}`
    : undefined;
  let fallback: string | undefined;

  for (let index = payloads.length - 1; index >= 0; index -= 1) {
    const text = mergeFragments(payloads[index]);
    if (!text) {
      continue;
    }

    if (marker && text.includes(marker)) {
      return text;
    }

    fallback ??= text;
  }

  return fallback;
}

type ParsedManagedA2AText = {
  raw_text: string;
  response_marker_matched: boolean;
  evidence_text?: string;
  recommendation?: string;
};

export function parseManagedA2ATextReply(
  text: string,
  requestId: string,
): ParsedManagedA2AText {
  const marker = `${MANAGED_A2A_RESPONSE_MARKER_PREFIX} ${requestId}`;
  const trimmed = text.trim();
  const response_marker_matched = trimmed.includes(marker);
  const evidenceMatch = /(?:^|\n)Evidence:\s*([\s\S]*?)(?:\nRecommendation:|$)/i.exec(trimmed);
  const recommendationMatch = /(?:^|\n)Recommendation:\s*([\s\S]*)$/i.exec(trimmed);
  const evidence_text = normalizeString(evidenceMatch?.[1]);
  const recommendation = normalizeString(recommendationMatch?.[1]);

  return {
    raw_text: trimmed,
    response_marker_matched,
    ...(evidence_text ? { evidence_text } : {}),
    ...(recommendation ? { recommendation } : {}),
  };
}

function tryParseJsonObject(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function extractJsonObjectFromMixedOutput(text: string): string | undefined {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      if (depth === 0) {
        continue;
      }
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const candidate = text.slice(start, index + 1);
        if (tryParseJsonObject(candidate)) {
          return candidate;
        }
      }
    }
  }

  return undefined;
}

export function parseCliJsonOutput(stdout: string): Record<string, unknown> {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("Local CLI returned empty stdout");
  }

  const direct = tryParseJsonObject(trimmed);
  if (direct) {
    return direct;
  }

  const extracted = extractJsonObjectFromMixedOutput(trimmed);
  const parsed = extracted ? tryParseJsonObject(extracted) : undefined;
  if (parsed) {
    return parsed;
  }

  throw new Error(
    `Local CLI stdout did not contain a valid top-level JSON object. stdout_prefix=${JSON.stringify(trimmed.slice(0, 160))}`,
  );
}
