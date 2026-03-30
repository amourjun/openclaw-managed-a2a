#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULTS = {
  profile: "managed-a2a-shadow",
  port: 18809,
  requesterChatId: "oc_shadow_dsp_5df9b085",
  targetAgentId: "domain-multimedia-ops-d7ec4d33",
  question: "Health check: reply only OK.",
  gatewayStartupTimeoutMs: 30000,
  commandTimeoutMs: 180000,
  keepGateway: false,
};

function printUsage() {
  console.log(`Usage: node scripts/verify-shadow-smoke.mjs [options]

Options:
  --profile <name>               Shadow profile name (default: ${DEFAULTS.profile})
  --port <number>                Shadow gateway port (default: ${DEFAULTS.port})
  --requester-chat-id <id>       Fake requester chat id (default: ${DEFAULTS.requesterChatId})
  --target-agent-id <id>         Target domain agent id (default: ${DEFAULTS.targetAgentId})
  --question <text>              Delegation question (default: "${DEFAULTS.question}")
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
      case "--target-agent-id":
        options.targetAgentId = value.trim();
        break;
      case "--question":
        options.question = value;
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

  const managed = extractFirstJsonBlock(payloadText);
  return {
    outer: parsed,
    managed,
  };
}

function resolveStateDir(profile) {
  return profile === "default"
    ? path.join(os.homedir(), ".openclaw")
    : path.join(os.homedir(), `.openclaw-${profile}`);
}

function buildInstruction(options) {
  return `Use the managed_a2a_feishu_delegate tool with chat_id ${options.requesterChatId}, target_agent_id ${options.targetAgentId}, question ${options.question} Return the raw tool result only.`;
}

function readAuditPath(managed) {
  const details =
    managed?.diagnostics &&
    typeof managed.diagnostics === "object" &&
    managed.diagnostics.details &&
    typeof managed.diagnostics.details === "object"
      ? managed.diagnostics.details
      : undefined;

  const auditPath = typeof details?.audit_path === "string" ? details.audit_path : undefined;
  const auditRef = typeof managed?.audit_ref === "string" ? managed.audit_ref : undefined;

  return auditPath ?? auditRef;
}

function assertManagedResult(managed, expectation) {
  const adapterId = managed?.diagnostics?.adapter_id;
  const managedStatus = managed?.managed_status;
  const reply = managed?.reply;
  const auditPath = readAuditPath(managed);

  const problems = [];
  if (managedStatus !== expectation.managedStatus) {
    problems.push(`expected managed_status=${expectation.managedStatus}, got ${managedStatus ?? "undefined"}`);
  }
  if (adapterId !== expectation.adapterId) {
    problems.push(`expected adapter_id=${expectation.adapterId}, got ${adapterId ?? "undefined"}`);
  }
  if (reply !== "OK") {
    problems.push(`expected reply=OK, got ${reply ?? "undefined"}`);
  }
  if (!auditPath || !fs.existsSync(auditPath)) {
    problems.push(`expected audit file to exist, got ${auditPath ?? "undefined"}`);
  }

  return {
    passed: problems.length === 0,
    managed_status: managedStatus,
    adapter_id: adapterId,
    reply,
    audit_path: auditPath,
    problems,
  };
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
        // keep polling until timeout
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
    target_agent_id: options.targetAgentId,
    question: options.question,
    validation: null,
    plugin: null,
    health: null,
    primary: null,
    local: null,
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

  const pluginsResult = runOpenClaw(
    ["--profile", options.profile, "plugins", "list", "--json", "--verbose"],
    options.commandTimeoutMs,
  );
  if (pluginsResult.status !== 0) {
    throw new Error(pluginsResult.output || "Plugin listing failed");
  }
  const pluginsParsed = parseCliJsonOutput(pluginsResult.output);
  const managedPlugin = Array.isArray(pluginsParsed?.plugins)
    ? pluginsParsed.plugins.find((plugin) => plugin?.id === "managed-a2a")
    : undefined;
  if (!managedPlugin) {
    throw new Error("managed-a2a plugin not found in plugin list");
  }
  report.plugin = {
    status: managedPlugin.status,
    source: managedPlugin.source,
    toolNames: managedPlugin.toolNames,
  };

  const requiredTools = ["managed_a2a_delegate", "managed_a2a_feishu_delegate"];
  for (const toolName of requiredTools) {
    if (!Array.isArray(managedPlugin.toolNames) || !managedPlugin.toolNames.includes(toolName)) {
      throw new Error(`managed-a2a plugin is missing required tool ${toolName}`);
    }
  }

  const gatewayLogs = [];
  const gatewayChild = spawn(
    "openclaw",
    ["--profile", options.profile, "gateway", "run", "--port", String(options.port), "--force"],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  attachProcessLogs(gatewayChild, gatewayLogs);

  try {
    report.health = await waitForGatewayHealth(options);

    const instruction = buildInstruction(options);

    const primaryResult = runOpenClaw(
      [
        "--profile",
        options.profile,
        "agent",
        "--agent",
        "main",
        "--session-id",
        createSessionId("managed-a2a-shadow-primary"),
        "--json",
        "--message",
        instruction,
      ],
      options.commandTimeoutMs,
    );
    if (primaryResult.status !== 0) {
      throw new Error(primaryResult.output || "Primary gateway-backed smoke test failed");
    }
    const primaryManaged = extractManagedResult(primaryResult);
    report.primary = {
      raw_status: primaryManaged.outer?.status ?? "unknown",
      summary: primaryManaged.outer?.summary,
      ...assertManagedResult(primaryManaged.managed, {
        managedStatus: "completed",
        adapterId: "runtime_subagent",
      }),
    };

    const localResult = runOpenClaw(
      [
        "--profile",
        options.profile,
        "agent",
        "--local",
        "--agent",
        "main",
        "--session-id",
        createSessionId("managed-a2a-shadow-local"),
        "--json",
        "--message",
        instruction,
      ],
      options.commandTimeoutMs,
    );
    if (localResult.status !== 0) {
      throw new Error(localResult.output || "Local fallback smoke test failed");
    }
    const localManaged = extractManagedResult(localResult);
    report.local = {
      ...assertManagedResult(localManaged.managed, {
        managedStatus: "degraded",
        adapterId: "cli_fallback",
      }),
    };

    report.passed = Boolean(report.primary?.passed && report.local?.passed && report.health?.ok);
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

main().catch(async (error) => {
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
