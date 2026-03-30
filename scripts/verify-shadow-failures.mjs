#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULTS = {
  profile: "managed-a2a-shadow",
  port: 18809,
  requesterChatId: "oc_shadow_dsp_5df9b085",
  requesterAgentId: "domain-dsp-ops-5df9b085",
  targetAgentId: "domain-multimedia-ops-d7ec4d33",
  invalidTargetAgentId: "domain-shadow-missing-target",
  gatewayStartupTimeoutMs: 30000,
  commandTimeoutMs: 180000,
  keepGateway: false,
};

function printUsage() {
  console.log(`Usage: node scripts/verify-shadow-failures.mjs [options]

Options:
  --profile <name>               Shadow profile name (default: ${DEFAULTS.profile})
  --port <number>                Shadow gateway port (default: ${DEFAULTS.port})
  --requester-chat-id <id>       Fake requester chat id (default: ${DEFAULTS.requesterChatId})
  --requester-agent-id <id>      Requester agent id (default: ${DEFAULTS.requesterAgentId})
  --target-agent-id <id>         Valid target agent id (default: ${DEFAULTS.targetAgentId})
  --invalid-target-agent-id <id> Invalid target id used for failure checks
  --gateway-startup-timeout-ms   Gateway startup timeout in milliseconds
  --command-timeout-ms           Timeout per OpenClaw CLI command in milliseconds
  --keep-gateway                 Leave the started gateway running after verification
  --help                         Show this help text
`);
}

function parseArgs(argv) {
  const options = { ...DEFAULTS };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--keep-gateway") {
      options.keepGateway = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const value = argv[index + 1];
    if (typeof value === "undefined" || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    index += 1;

    switch (arg) {
      case "--profile":
        options.profile = value.trim();
        break;
      case "--port":
        options.port = Number.parseInt(value, 10);
        break;
      case "--requester-chat-id":
        options.requesterChatId = value.trim();
        break;
      case "--requester-agent-id":
        options.requesterAgentId = value.trim();
        break;
      case "--target-agent-id":
        options.targetAgentId = value.trim();
        break;
      case "--invalid-target-agent-id":
        options.invalidTargetAgentId = value.trim();
        break;
      case "--gateway-startup-timeout-ms":
        options.gatewayStartupTimeoutMs = Number.parseInt(value, 10);
        break;
      case "--command-timeout-ms":
        options.commandTimeoutMs = Number.parseInt(value, 10);
        break;
      default:
        throw new Error(`Unsupported option: ${arg}`);
    }
  }

  if (!options.profile) {
    throw new Error("profile must be a non-empty string");
  }
  if (!Number.isInteger(options.port) || options.port <= 0) {
    throw new Error("port must be a positive integer");
  }
  if (!Number.isInteger(options.gatewayStartupTimeoutMs) || options.gatewayStartupTimeoutMs <= 0) {
    throw new Error("gateway-startup-timeout-ms must be a positive integer");
  }
  if (!Number.isInteger(options.commandTimeoutMs) || options.commandTimeoutMs <= 0) {
    throw new Error("command-timeout-ms must be a positive integer");
  }

  return options;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createSessionId(prefix) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${prefix}-${stamp}-${Math.random().toString(16).slice(2, 8)}`;
}

function combineOutput(result) {
  return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
}

function runOpenClaw(args, timeoutMs) {
  const result = spawnSync("openclaw", args, {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
  });

  return {
    status: result.status ?? 1,
    signal: result.signal ?? null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    output: combineOutput(result),
  };
}

function extractFirstJsonBlock(text) {
  const startChars = new Set(["{", "["]);

  for (let start = 0; start < text.length; start += 1) {
    if (!startChars.has(text[start])) continue;

    const stack = [];
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
        continue;
      }

      if (char === "{" || char === "[") {
        stack.push(char);
        continue;
      }

      if (char === "}" || char === "]") {
        const open = stack.pop();
        if (!open) break;
        if ((open === "{" && char !== "}") || (open === "[" && char !== "]")) {
          break;
        }
        if (stack.length === 0) {
          const candidate = text.slice(start, index + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error("Unable to extract JSON from OpenClaw output");
}

function parseCliJsonOutput(output) {
  return extractFirstJsonBlock(output);
}

function extractManagedResult(agentCommandResult) {
  const parsed = parseCliJsonOutput(agentCommandResult.output);
  const container =
    parsed && typeof parsed === "object" && parsed !== null && "result" in parsed
      ? parsed.result
      : parsed;

  const payloads =
    container && typeof container === "object" && container !== null && Array.isArray(container.payloads)
      ? container.payloads
      : [];

  const payloadText = payloads.find((entry) => entry && typeof entry.text === "string")?.text;
  if (!payloadText) {
    throw new Error("Agent output did not contain a text payload");
  }

  return {
    outer: parsed,
    managed: extractFirstJsonBlock(payloadText),
  };
}

function resolveStateDir(profile) {
  return profile === "default"
    ? path.join(os.homedir(), ".openclaw")
    : path.join(os.homedir(), `.openclaw-${profile}`);
}

function collectRecentLogs(buffer) {
  return buffer.slice(-30);
}

function attachProcessLogs(child, buffer) {
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on("data", (chunk) => {
      const text = String(chunk);
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed) {
          buffer.push(trimmed);
        }
      }
    });
  }
}

async function waitForGatewayHealth(options) {
  const deadline = Date.now() + options.gatewayStartupTimeoutMs;
  let lastOutput = "";

  while (Date.now() < deadline) {
    const result = runOpenClaw(
      ["--profile", options.profile, "gateway", "health", "--json"],
      15000,
    );
    lastOutput = result.output;

    if (result.status === 0) {
      try {
        const parsed = parseCliJsonOutput(result.output);
        if (parsed?.ok === true) {
          return parsed;
        }
      } catch {
        // keep polling
      }
    }

    await delay(1000);
  }

  throw new Error(`Gateway health did not become ready in time. Last output:\n${lastOutput}`);
}

async function stopGatewayChild(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.kill("SIGINT");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(5000),
  ]);

  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("exit", resolve));
  }
}

function buildFeishuPrompt(message) {
  return `Use the managed_a2a_feishu_delegate tool ${message} Return the raw tool result only.`;
}

function buildCorePrompt(message) {
  return `Use the managed_a2a_delegate tool ${message} Return the raw tool result only.`;
}

function assertMatch(actual, expected, field, problems) {
  if (actual !== expected) {
    problems.push(`expected ${field}=${expected}, got ${actual ?? "undefined"}`);
  }
}

function readManagedField(managed, pathParts) {
  let current = managed;
  for (const part of pathParts) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function evaluateCase(name, managed, expectations) {
  const problems = [];
  for (const [field, expected] of Object.entries(expectations.equals ?? {})) {
    const actual = readManagedField(managed, field.split("."));
    assertMatch(actual, expected, field, problems);
  }
  for (const [field, fragment] of Object.entries(expectations.includes ?? {})) {
    const actual = readManagedField(managed, field.split("."));
    if (typeof actual !== "string" || !actual.includes(fragment)) {
      problems.push(`expected ${field} to include "${fragment}", got ${typeof actual === "string" ? actual : "undefined"}`);
    }
  }

  return {
    name,
    passed: problems.length === 0,
    output: managed,
    problems,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const stateDir = resolveStateDir(options.profile);
  const configPath = path.join(stateDir, "openclaw.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Shadow profile config not found: ${configPath}\nRun: node scripts/setup-shadow-profile.mjs --profile ${options.profile} --port ${options.port}`,
    );
  }

  const report = {
    profile: options.profile,
    port: options.port,
    configPath,
    requester_chat_id: options.requesterChatId,
    requester_agent_id: options.requesterAgentId,
    target_agent_id: options.targetAgentId,
    validation: null,
    health: null,
    cases: [],
    passed: false,
  };

  const validateResult = runOpenClaw(
    ["--profile", options.profile, "config", "validate", "--json"],
    options.commandTimeoutMs,
  );
  if (validateResult.status !== 0) {
    throw new Error(validateResult.output || "Config validation failed");
  }
  report.validation = parseCliJsonOutput(validateResult.output);

  const gatewayLogs = [];
  const gatewayChild = spawn(
    "openclaw",
    ["--profile", options.profile, "gateway", "run", "--port", String(options.port), "--force"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  attachProcessLogs(gatewayChild, gatewayLogs);

  try {
    report.health = await waitForGatewayHealth(options);

    const cases = [
      {
        name: "feishu_target_unresolved",
        prompt: buildFeishuPrompt(
          `with chat_id ${options.requesterChatId}, target_agent_id ${options.invalidTargetAgentId}, question Please investigate this target.`,
        ),
        expectations: {
          equals: {
            status: "ask_clarify",
            decision: "ASK_CLARIFY",
            decision_reason: "target_unresolved",
          },
          includes: {
            error: "not found in active domain registry",
          },
        },
      },
      {
        name: "feishu_requester_resolution_failed",
        prompt: buildFeishuPrompt(
          `with target_agent_id ${options.targetAgentId}, question Health check: reply only OK.`,
        ),
        expectations: {
          equals: {
            status: "error",
            error_code: "RESOLUTION_FAILED",
            "diagnostics.category": "resolution_failed",
          },
          includes: {
            error: "Unable to resolve requester_agent_id",
          },
        },
      },
      {
        name: "core_loop_detected",
        prompt: buildCorePrompt(
          `with request_id req_loop_detected_001, requester_agent_id ${options.requesterAgentId}, target_agent_id ${options.targetAgentId}, question Health check: reply only OK., mode orchestrated_internal, ttl_seconds 30, hop 1, visited_agents ["${options.requesterAgentId}","${options.targetAgentId}"], publish_contract evidence_only, external_announce forbidden, timeout_seconds 20.`,
        ),
        expectations: {
          equals: {
            status: "rejected",
            "error.category": "policy_denied",
            "diagnostics.category": "policy_denied",
          },
          includes: {
            "error.message": "visited_agents",
          },
        },
      },
      {
        name: "core_timeout_exceeds_ttl",
        prompt: buildCorePrompt(
          `with request_id req_invalid_timeout_001, requester_agent_id ${options.requesterAgentId}, target_agent_id ${options.targetAgentId}, question Health check: reply only OK., mode orchestrated_internal, ttl_seconds 5, hop 1, visited_agents ["${options.requesterAgentId}"], publish_contract evidence_only, external_announce forbidden, timeout_seconds 20.`,
        ),
        expectations: {
          equals: {
            status: "failed",
            "error.category": "invalid_request",
            "diagnostics.category": "invalid_request",
          },
          includes: {
            "error.message": "timeout_seconds",
          },
        },
      },
    ];

    for (const entry of cases) {
      const result = runOpenClaw(
        [
          "--profile",
          options.profile,
          "agent",
          "--agent",
          "main",
          "--session-id",
          createSessionId(`managed-a2a-negative-${entry.name}`),
          "--json",
          "--message",
          entry.prompt,
        ],
        options.commandTimeoutMs,
      );

      if (result.status !== 0) {
        throw new Error(`${entry.name} command failed:\n${result.output}`);
      }

      const parsed = extractManagedResult(result);
      report.cases.push(evaluateCase(entry.name, parsed.managed, entry.expectations));
    }

    report.passed = report.cases.every((entry) => entry.passed) && report.health?.ok === true;
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    report.gateway_logs = collectRecentLogs(gatewayLogs);
    throw Object.assign(new Error(report.error), { report });
  } finally {
    if (!options.keepGateway) {
      await stopGatewayChild(gatewayChild);
    }
  }

  console.log(JSON.stringify(report, null, 2));

  if (!report.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  if (error && typeof error === "object" && "report" in error && error.report) {
    console.error(JSON.stringify(error.report, null, 2));
  } else {
    console.error(
      JSON.stringify(
        {
          passed: false,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
  }
  process.exit(1);
});
