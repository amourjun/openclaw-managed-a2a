import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { describe, expect, it } from "vitest";
import plugin from "../index.js";
import { createTestPluginApi } from "./test-plugin-api.js";

type TestRuntimeOverrides = Partial<
  Omit<OpenClawPluginApi["runtime"], "system" | "logging" | "state" | "subagent">
> & {
  system?: Partial<OpenClawPluginApi["runtime"]["system"]>;
  logging?: Partial<OpenClawPluginApi["runtime"]["logging"]>;
  state?: Partial<OpenClawPluginApi["runtime"]["state"]>;
  subagent?: Partial<OpenClawPluginApi["runtime"]["subagent"]>;
};

function createTestRuntime(overrides?: TestRuntimeOverrides) {
  const baseRuntime = {
    version: "2026.3.13",
    config: {},
    system: {
      enqueueSystemEvent() {
        return true;
      },
      requestHeartbeatNow() {},
      async runCommandWithTimeout() {
        return {
          pid: 1,
          stdout: "",
          stderr: "",
          code: 0,
          signal: null,
          killed: false,
          termination: "exit" as const,
        };
      },
      formatNativeDependencyHint() {
        return "";
      },
    },
    media: {},
    tts: {},
    stt: {},
    tools: {},
    events: {},
    logging: {
      shouldLogVerbose() {
        return false;
      },
      getChildLogger() {
        return {
          info() {},
          warn() {},
          error() {},
        };
      },
    },
    state: {
      resolveStateDir() {
        return path.join(os.tmpdir(), "openclaw-managed-a2a-test-state");
      },
    },
    modelAuth: {},
    subagent: {
      async run() {
        return { runId: "run_default" };
      },
      async waitForRun() {
        return { status: "ok" as const };
      },
      async getSessionMessages() {
        return {
          messages: [],
        };
      },
      async getSession() {
        return {
          messages: [],
        };
      },
      async deleteSession() {},
    },
    channel: {},
  };

  return {
    ...baseRuntime,
    ...overrides,
    system: {
      ...baseRuntime.system,
      ...overrides?.system,
    },
    logging: {
      ...baseRuntime.logging,
      ...overrides?.logging,
    },
    state: {
      ...baseRuntime.state,
      ...overrides?.state,
    },
    subagent: {
      ...baseRuntime.subagent,
      ...overrides?.subagent,
    },
  } as OpenClawPluginApi["runtime"];
}

async function createRegistryFixture(): Promise<{
  registryPath: string;
  requesterChatId: string;
  targetChatId: string;
  requesterAgentId: string;
  targetAgentId: string;
}> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "managed-a2a-feishu-registry-"));
  const registryPath = path.join(dir, "feishu-domain-registry.json");
  const requesterChatId = "oc_requester";
  const targetChatId = "oc_target";
  const requesterAgentId = "domain-dsp-ops";
  const targetAgentId = "domain-multimedia-ops";
  await writeFile(
    registryPath,
    JSON.stringify(
      {
        version: 2,
        domains: [
          {
            chat_id: requesterChatId,
            agent_id: requesterAgentId,
            display_name: "DSP Agent",
            alias_en: "dsp-agent",
            enabled: true,
            status: "active",
            domain_type: "domain",
            notes: "DSP owner",
          },
          {
            chat_id: targetChatId,
            agent_id: targetAgentId,
            display_name: "Multimedia Agent",
            alias_en: "multimedia-agent",
            enabled: true,
            status: "active",
            domain_type: "domain",
            notes: "Media owner",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );
  return {
    registryPath,
    requesterChatId,
    targetChatId,
    requesterAgentId,
    targetAgentId,
  };
}

function registerFeishuTool(params: {
  registryPath: string;
  runtime?: OpenClawPluginApi["runtime"];
  toolName?: string;
}) {
  let registeredTool:
    | { name?: string; execute: (id: string, rawParams: Record<string, unknown>) => Promise<any> }
    | undefined;

  const api = createTestPluginApi({
    id: "managed-a2a",
    name: "Managed A2A",
    source: "test",
    config: {},
    runtime: params.runtime ?? createTestRuntime(),
    pluginConfig: {
      channelAdapters: {
        feishu: {
          enabled: true,
          registryPath: params.registryPath,
          ...(params.toolName ? { toolName: params.toolName } : {}),
        },
      },
    },
    registerTool(tool) {
      if ((tool as { name?: string }).name === (params.toolName ?? "managed_a2a_feishu_delegate")) {
        registeredTool = tool as typeof registeredTool;
      }
    },
  });

  plugin.register(api);

  if (!registeredTool) {
    throw new Error("Feishu adapter tool was not registered");
  }

  return registeredTool;
}

describe("managed-a2a Feishu channel adapter", () => {
  it("normalizes channel-native inputs and delegates through the core path", async () => {
    const fixture = await createRegistryFixture();
    const tool = registerFeishuTool({
      registryPath: fixture.registryPath,
      runtime: createTestRuntime({
        subagent: {
          async run() {
            return { runId: "run_feishu_001" };
          },
          async waitForRun() {
            return { status: "ok" as const };
          },
          async getSessionMessages() {
            return {
              messages: [
                {
                  role: "assistant",
                  content: [
                    {
                      type: "text",
                      text: [
                        "MANAGED_A2A_REQUEST_ID: req_feishu_001",
                        "Evidence:",
                        "OK",
                        "",
                        "Recommendation:",
                        "Feishu adapter path is healthy.",
                      ].join("\n"),
                    },
                  ],
                },
              ],
            };
          },
        },
      }),
    });

    const result = await tool.execute("tool-1", {
      request_id: "req_feishu_001",
      chat_id: fixture.requesterChatId,
      target_chat_id: fixture.targetChatId,
      question: "Health check: reply only OK",
    });

    expect(result.details).toMatchObject({
      status: "ok",
      managed_status: "completed",
      request_id: "req_feishu_001",
      requester_agent_id: fixture.requesterAgentId,
      target_agent_id: fixture.targetAgentId,
      matched_by: "target_chat_id",
      reply: "OK",
      recommendation: "Feishu adapter path is healthy.",
    });
  });

  it("returns ask_clarify when the target cannot be resolved", async () => {
    const fixture = await createRegistryFixture();
    const tool = registerFeishuTool({
      registryPath: fixture.registryPath,
    });

    const result = await tool.execute("tool-2", {
      request_id: "req_feishu_ask_001",
      chat_id: fixture.requesterChatId,
      target: "missing-target",
      question: "Please investigate this target",
    });

    expect(result.details).toMatchObject({
      status: "ask_clarify",
      request_id: "req_feishu_ask_001",
      decision: "ASK_CLARIFY",
      decision_reason: "target_unresolved",
    });
    expect(result.details.candidates).toHaveLength(2);
  });

  it("surfaces requester resolution failures separately from transport failures", async () => {
    const fixture = await createRegistryFixture();
    const tool = registerFeishuTool({
      registryPath: fixture.registryPath,
    });

    const result = await tool.execute("tool-3", {
      request_id: "req_feishu_err_001",
      target_agent_id: fixture.targetAgentId,
      question: "Health check: reply only OK",
    });

    expect(result.details).toMatchObject({
      status: "error",
      request_id: "req_feishu_err_001",
      error_code: "RESOLUTION_FAILED",
      diagnostics: {
        category: "resolution_failed",
      },
    });
  });

  it("supports dry_run without dispatching to the core transport", async () => {
    const fixture = await createRegistryFixture();
    const tool = registerFeishuTool({
      registryPath: fixture.registryPath,
    });

    const result = await tool.execute("tool-4", {
      request_id: "req_feishu_dry_001",
      chat_id: fixture.requesterChatId,
      target_agent_id: fixture.targetAgentId,
      question: "Health check: reply only OK",
      dry_run: true,
    });

    expect(result.details).toMatchObject({
      status: "dry_run",
      request_id: "req_feishu_dry_001",
      requester_agent_id: fixture.requesterAgentId,
      target_agent_id: fixture.targetAgentId,
      target_session_key: `agent:${fixture.targetAgentId}:main`,
      decision: "DELEGATE",
      decision_reason: "cross_domain_delegation",
    });
    expect(result.details.message_preview).toContain("MANAGED_A2A_REQUEST_ID: req_feishu_dry_001");
  });

  it("maps loop-detection policy failures to LOOP_DETECTED", async () => {
    const fixture = await createRegistryFixture();
    const tool = registerFeishuTool({
      registryPath: fixture.registryPath,
    });

    const result = await tool.execute("tool-5", {
      request_id: "req_feishu_loop_001",
      chat_id: fixture.requesterChatId,
      target_agent_id: fixture.targetAgentId,
      question: "Health check: reply only OK",
      visited_agents: [fixture.targetAgentId],
    });

    expect(result.details).toMatchObject({
      status: "rejected",
      request_id: "req_feishu_loop_001",
      target_agent_id: fixture.targetAgentId,
      error_code: "LOOP_DETECTED",
      diagnostics: {
        category: "policy_denied",
      },
    });
  });
});
