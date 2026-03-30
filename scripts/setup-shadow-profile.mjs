#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const DEFAULT_PROFILE = "managed-a2a-shadow";
const DEFAULT_PORT = 18809;
const DEFAULT_SOURCE_CONFIG = path.join(os.homedir(), ".openclaw", "openclaw.json");
const DEFAULT_WORKSPACE_ROOT = path.join(os.homedir(), "clawd-managed-a2a-shadow");
const DEFAULT_AGENT_IDS = [
  "domain-dsp-ops-5df9b085",
  "domain-multimedia-ops-d7ec4d33",
];
const DEFAULT_FAKE_CHATS = {
  "domain-dsp-ops-5df9b085": "oc_shadow_dsp_5df9b085",
  "domain-multimedia-ops-d7ec4d33": "oc_shadow_multimedia_d7ec4d33",
};

function printUsage() {
  console.log(`Usage: node scripts/setup-shadow-profile.mjs [options]

Options:
  --profile <name>          Shadow profile name (default: ${DEFAULT_PROFILE})
  --port <number>           Gateway port (default: ${DEFAULT_PORT})
  --source-config <path>    Source OpenClaw config to copy model providers from
  --workspace-root <path>   Root directory for shadow agent workspaces
  --plugin-source <path>    Local plugin checkout to link into the shadow profile
  --help                    Show this help text
`);
}

function expandHome(value) {
  return value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : value;
}

function parseArgs(argv) {
  const options = {
    profile: DEFAULT_PROFILE,
    port: DEFAULT_PORT,
    sourceConfig: DEFAULT_SOURCE_CONFIG,
    workspaceRoot: DEFAULT_WORKSPACE_ROOT,
    pluginSource: repoRoot,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") {
      options.help = true;
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
      case "--source-config":
        options.sourceConfig = expandHome(value.trim());
        break;
      case "--workspace-root":
        options.workspaceRoot = expandHome(value.trim());
        break;
      case "--plugin-source":
        options.pluginSource = path.resolve(expandHome(value.trim()));
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

  return options;
}

function stateDirForProfile(profile) {
  return profile === "default"
    ? path.join(os.homedir(), ".openclaw")
    : path.join(os.homedir(), `.openclaw-${profile}`);
}

function configPathForProfile(profile) {
  return path.join(stateDirForProfile(profile), "openclaw.json");
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function runOpenClaw(args, options = {}) {
  const result = spawnSync("openclaw", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? "";
    const stdout = result.stdout?.trim() ?? "";
    throw new Error(
      `openclaw ${args.join(" ")} failed\n${stderr || stdout || `exit code ${result.status ?? "unknown"}`}`,
    );
  }

  return result;
}

function ensureAgent(profile, agentId, workspaceRoot) {
  const workspace = path.join(workspaceRoot, "domains", agentId);
  fs.mkdirSync(workspace, { recursive: true });

  const configPath = configPathForProfile(profile);
  if (fs.existsSync(configPath)) {
    const config = readJsonFile(configPath);
    const existingAgents = Array.isArray(config?.agents?.list) ? config.agents.list : [];
    if (existingAgents.some((agent) => agent?.id === agentId)) {
      return workspace;
    }
  }

  runOpenClaw([
    "--profile",
    profile,
    "agents",
    "add",
    agentId,
    "--workspace",
    workspace,
    "--non-interactive",
    "--json",
  ]);
  return workspace;
}

function ensurePluginLinked(profile, pluginSource) {
  const configPath = configPathForProfile(profile);
  if (fs.existsSync(configPath)) {
    const config = readJsonFile(configPath);
    const sourcePath = config?.plugins?.installs?.["managed-a2a"]?.sourcePath;
    if (sourcePath === pluginSource) {
      return;
    }
  }

  runOpenClaw([
    "--profile",
    profile,
    "plugins",
    "install",
    "-l",
    pluginSource,
  ]);
}

function deriveProviderKeys(mainConfig) {
  const keys = new Set();
  const primary = mainConfig?.agents?.defaults?.model?.primary;
  if (typeof primary === "string" && primary.includes("/")) {
    keys.add(primary.split("/", 1)[0]);
  }

  const modelMap = mainConfig?.agents?.defaults?.models;
  if (modelMap && typeof modelMap === "object") {
    for (const key of Object.keys(modelMap)) {
      if (key.includes("/")) {
        keys.add(key.split("/", 1)[0]);
      }
    }
  }

  return [...keys];
}

function pickProviders(mainConfig) {
  const providerKeys = deriveProviderKeys(mainConfig);
  const providers = mainConfig?.models?.providers ?? {};
  const selected = {};
  for (const key of providerKeys) {
    if (providers[key]) {
      selected[key] = providers[key];
    }
  }
  return Object.keys(selected).length > 0 ? selected : providers;
}

function ensureArrayIncludes(arrayValue, expected) {
  const existing = Array.isArray(arrayValue) ? arrayValue : [];
  return [...new Set([...existing, ...expected])];
}

function enableManagedA2ATools(agentRecord) {
  const currentTools =
    agentRecord?.tools && typeof agentRecord.tools === "object" && !Array.isArray(agentRecord.tools)
      ? agentRecord.tools
      : {};
  return {
    ...agentRecord,
    tools: {
      ...currentTools,
      allow: ensureArrayIncludes(currentTools.allow, ["managed-a2a"]),
    },
  };
}

function buildRegistry(agentIds) {
  return {
    version: 2,
    domains: agentIds.map((agentId) => ({
      chat_id: DEFAULT_FAKE_CHATS[agentId] ?? `oc_shadow_${agentId.replace(/[^a-zA-Z0-9]+/g, "_")}`,
      agent_id: agentId,
      display_name: agentId,
      alias_en: agentId,
      enabled: true,
      status: "active",
      domain_type: "shadow-validation",
      owner: "managed-a2a-shadow",
      notes: "Fake chat id for local adapter validation only. No real Feishu traffic.",
    })),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  if (!fs.existsSync(options.sourceConfig)) {
    throw new Error(`Source config not found: ${options.sourceConfig}`);
  }
  if (!fs.existsSync(path.join(options.pluginSource, "openclaw.plugin.json"))) {
    throw new Error(`Plugin source does not look like an OpenClaw plugin checkout: ${options.pluginSource}`);
  }

  const stateDir = stateDirForProfile(options.profile);
  const configPath = configPathForProfile(options.profile);
  const registryPath = path.join(stateDir, "domain-agent", "feishu-domain-registry.json");
  const auditDir = path.join(stateDir, "managed-a2a", "audit");
  const gatewayToken = crypto.randomBytes(24).toString("hex");

  fs.mkdirSync(options.workspaceRoot, { recursive: true });
  fs.mkdirSync(path.join(stateDir, "domain-agent"), { recursive: true });
  fs.mkdirSync(auditDir, { recursive: true });

  for (const agentId of DEFAULT_AGENT_IDS) {
    ensureAgent(options.profile, agentId, options.workspaceRoot);
  }

  ensurePluginLinked(options.profile, options.pluginSource);

  const mainConfig = readJsonFile(options.sourceConfig);
  const shadowConfig = fs.existsSync(configPath) ? readJsonFile(configPath) : {};

  shadowConfig.meta = {
    ...(shadowConfig.meta ?? {}),
    lastTouchedVersion: mainConfig?.meta?.lastTouchedVersion ?? shadowConfig?.meta?.lastTouchedVersion,
    lastTouchedAt: new Date().toISOString(),
  };

  shadowConfig.models = {
    ...(shadowConfig.models ?? {}),
    providers: pickProviders(mainConfig),
  };

  shadowConfig.agents = shadowConfig.agents ?? {};
  shadowConfig.agents.defaults = {
    ...(shadowConfig.agents.defaults ?? {}),
    ...(mainConfig?.agents?.defaults ?? {}),
    workspace: options.workspaceRoot,
  };
  shadowConfig.agents.list = Array.isArray(shadowConfig.agents.list)
    ? shadowConfig.agents.list.map((agent) => {
        if (!agent || typeof agent !== "object") {
          return agent;
        }
        const record = agent;
        if (
          record.id === "main" ||
          record.id === "domain-dsp-ops-5df9b085" ||
          record.id === "domain-multimedia-ops-d7ec4d33"
        ) {
          return enableManagedA2ATools(record);
        }
        return record;
      })
    : shadowConfig.agents.list;

  shadowConfig.tools = {
    ...(shadowConfig.tools ?? {}),
    agentToAgent: {
      enabled: true,
      ...(shadowConfig.tools?.agentToAgent ?? {}),
    },
  };

  shadowConfig.gateway = {
    port: options.port,
    mode: "local",
    bind: "loopback",
    auth: {
      mode: "token",
      token: gatewayToken,
    },
    remote: {
      url: `ws://127.0.0.1:${options.port}`,
      token: gatewayToken,
    },
  };

  shadowConfig.plugins = shadowConfig.plugins ?? {};
  shadowConfig.plugins.enabled = true;
  shadowConfig.plugins.allow = ensureArrayIncludes(shadowConfig.plugins.allow, ["managed-a2a"]);
  shadowConfig.plugins.entries = shadowConfig.plugins.entries ?? {};
  shadowConfig.plugins.entries["managed-a2a"] = {
    ...(shadowConfig.plugins.entries["managed-a2a"] ?? {}),
    enabled: true,
    config: {
      enabled: true,
      preferredAdapter: "auto",
      allowCliFallback: true,
      defaultTtlSeconds: 30,
      maxTtlSeconds: 300,
      defaultTimeoutSeconds: 20,
      auditDir,
      channelAdapters: {
        feishu: {
          enabled: true,
          toolName: "managed_a2a_feishu_delegate",
          registryPath,
        },
      },
    },
  };
  shadowConfig.plugins.load = shadowConfig.plugins.load ?? {};
  shadowConfig.plugins.load.paths = ensureArrayIncludes(shadowConfig.plugins.load.paths, [
    options.pluginSource,
  ]);

  delete shadowConfig.channels;
  delete shadowConfig.bindings;
  delete shadowConfig.hooks;

  writeJsonFile(configPath, shadowConfig);
  writeJsonFile(registryPath, buildRegistry(DEFAULT_AGENT_IDS));

  const validate = runOpenClaw([
    "--profile",
    options.profile,
    "config",
    "validate",
    "--json",
  ]);
  const plugins = runOpenClaw([
    "--profile",
    options.profile,
    "plugins",
    "list",
    "--json",
    "--verbose",
  ]);

  const pluginInfo = JSON.parse(plugins.stdout.replace(/^[\s\S]*?(\{)/, "$1"));
  const managed = Array.isArray(pluginInfo.plugins)
    ? pluginInfo.plugins.find((plugin) => plugin?.id === "managed-a2a")
    : undefined;

  console.log(JSON.stringify({
    profile: options.profile,
    port: options.port,
    configPath,
    workspaceRoot: options.workspaceRoot,
    registryPath,
    auditDir,
    validation: JSON.parse(validate.stdout),
    managedA2A: managed
      ? {
          status: managed.status,
          toolNames: managed.toolNames,
          source: managed.source,
        }
      : null,
    nextSteps: [
      `openclaw --profile ${options.profile} plugins list --json --verbose`,
      `openclaw --profile ${options.profile} gateway run --port ${options.port}`,
      `openclaw --profile ${options.profile} agent --agent main --json --message "Use the managed_a2a_feishu_delegate tool with chat_id ${DEFAULT_FAKE_CHATS["domain-dsp-ops-5df9b085"]}, target_agent_id domain-multimedia-ops-d7ec4d33, question Health check: reply only OK. Return the raw tool result only."`,
      `openclaw --profile ${options.profile} agent --local --agent main --json --message "Use the managed_a2a_feishu_delegate tool with chat_id ${DEFAULT_FAKE_CHATS["domain-dsp-ops-5df9b085"]}, target_agent_id domain-multimedia-ops-d7ec4d33, question Health check: reply only OK. Return the raw tool result only."`,
    ],
  }, null, 2));
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`setup-shadow-profile failed: ${message}`);
  process.exit(1);
}
