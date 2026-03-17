import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { describe, expect, it } from "vitest";
import { createCliFallbackAdapter } from "../src/adapters/cli-fallback.js";
import { createRuntimeSubagentAdapter } from "../src/adapters/runtime-subagent.js";
import { persistManagedA2AAuditTrace } from "../src/audit/store.js";
import { resolveManagedA2APluginConfig } from "../src/config.js";
import type { ManagedA2ARequestEnvelope } from "../src/protocol/types.js";
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

function createRequest(): ManagedA2ARequestEnvelope {
  return {
    request_id: "req_exec_001",
    requester_agent_id: "domain-dsp-ops",
    target_agent_id: "domain-multimedia-ops",
    question: "Health check: reply only OK",
    mode: "orchestrated_internal",
    ttl_seconds: 30,
    timeout_seconds: 20,
    hop: 1,
    visited_agents: ["domain-dsp-ops"],
    publish_contract: "evidence_only",
    external_announce: "forbidden",
  };
}

describe("managed-a2a adapter execution", () => {
  it("completes through runtime_subagent and extracts structured reply", async () => {
    const adapter = createRuntimeSubagentAdapter();
    const api = createTestPluginApi({
      id: "managed-a2a",
      name: "Managed A2A",
      source: "test",
      config: {},
      runtime: createTestRuntime({
        subagent: {
          async run() {
            return { runId: "run_123" };
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
                        "MANAGED_A2A_REQUEST_ID: req_exec_001",
                        "Evidence:",
                        "OK",
                        "",
                        "Recommendation:",
                        "Use this as the health-check evidence.",
                      ].join("\n"),
                    },
                  ],
                },
              ],
            };
          },
          async getSession() {
            return { messages: [] };
          },
          async deleteSession() {},
        },
      }),
    });

    const result = await adapter.execute({
      api,
      config: resolveManagedA2APluginConfig(undefined),
      request: createRequest(),
      auditEvents: [],
    });

    expect(result.status).toBe("completed");
    expect(result.evidence).toMatchObject({
      target_agent_id: "domain-multimedia-ops",
      run_id: "run_123",
      text: "OK",
    });
    expect(result.recommendation).toContain("health-check");
  });

  it("falls back to local CLI when runtime_subagent is unavailable in the current context", async () => {
    const adapter = createRuntimeSubagentAdapter();
    const api = createTestPluginApi({
      id: "managed-a2a",
      name: "Managed A2A",
      source: "test",
      config: {},
      runtime: createTestRuntime({
        system: {
          async runCommandWithTimeout() {
            return {
              pid: 1,
              stdout: JSON.stringify({
                payloads: [
                  {
                    text: [
                      "MANAGED_A2A_REQUEST_ID: req_exec_001",
                      "Evidence:",
                      "CLI_OK",
                      "",
                      "Recommendation:",
                      "Fallback path is healthy.",
                    ].join("\n"),
                  },
                ],
              }),
              stderr: "",
              code: 0,
              signal: null,
              killed: false,
              termination: "exit" as const,
            };
          },
        },
        subagent: {
          async run() {
            throw new Error(
              "Plugin runtime subagent methods are only available during a gateway request.",
            );
          },
          async waitForRun() {
            return { status: "ok" as const };
          },
          async getSessionMessages() {
            return { messages: [] };
          },
          async getSession() {
            return { messages: [] };
          },
          async deleteSession() {},
        },
      }),
    });

    const result = await adapter.execute({
      api,
      config: resolveManagedA2APluginConfig(undefined),
      request: createRequest(),
      auditEvents: [],
    });

    expect(result.status).toBe("degraded");
    expect(result.evidence).toMatchObject({
      target_agent_id: "domain-multimedia-ops",
      text: "CLI_OK",
    });
  });

  it("persists an audit trace to disk", async () => {
    const auditDir = await mkdtemp(path.join(os.tmpdir(), "managed-a2a-audit-"));
    const request = createRequest();
    const result = await createCliFallbackAdapter().execute({
      api: createTestPluginApi({
        id: "managed-a2a",
        name: "Managed A2A",
        source: "test",
        config: {},
        runtime: createTestRuntime({
          system: {
            async runCommandWithTimeout() {
              return {
                pid: 1,
                stdout: JSON.stringify({
                  payloads: [
                    {
                      text: "MANAGED_A2A_REQUEST_ID: req_exec_001\nEvidence:\nOK",
                    },
                  ],
                }),
                stderr: "",
                code: 0,
                signal: null,
                killed: false,
                termination: "exit" as const,
              };
            },
          },
        }),
      }),
      config: resolveManagedA2APluginConfig({
        auditDir,
      }),
      request,
      auditEvents: [
        {
          stage: "accepted",
          request_id: request.request_id,
          message: "accepted",
        },
      ],
    });

    const filePath = await persistManagedA2AAuditTrace({
      api: createTestPluginApi({
        id: "managed-a2a",
        name: "Managed A2A",
        source: "test",
        config: {},
        runtime: createTestRuntime(),
      }),
      config: resolveManagedA2APluginConfig({
        auditDir,
      }),
      request,
      result,
      auditEvents: [
        {
          stage: "accepted",
          request_id: request.request_id,
          message: "accepted",
        },
      ],
    });

    const content = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
    expect(content.request).toMatchObject({
      request_id: "req_exec_001",
    });
    expect(content.result).toMatchObject({
      request_id: "req_exec_001",
    });
  });
});
