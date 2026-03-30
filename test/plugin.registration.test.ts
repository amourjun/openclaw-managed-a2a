import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { describe, expect, it } from "vitest";
import plugin from "../index.js";
import { createTestPluginApi } from "./test-plugin-api.js";

describe("managed-a2a plugin registration", () => {
  it("registers the managed_a2a_delegate tool as optional", () => {
    let registeredTool: unknown;
    let registeredOptions: unknown;

    const runtime = {} as OpenClawPluginApi["runtime"];

    const api = createTestPluginApi({
      id: "managed-a2a",
      name: "Managed A2A",
      source: "test",
      config: {},
      runtime,
      registerTool(tool, options) {
        registeredTool = tool;
        registeredOptions = options;
      },
    });

    plugin.register(api);

    expect(registeredTool).toMatchObject({
      name: "managed_a2a_delegate",
    });
    expect(registeredOptions).toEqual({ optional: true });
  });

  it("returns a rejected result when the plugin is disabled", async () => {
    const runtime = {} as OpenClawPluginApi["runtime"];
    let registeredTool:
      | { execute: (id: string, params: Record<string, unknown>) => Promise<any> }
      | undefined;

    const api = createTestPluginApi({
      id: "managed-a2a",
      name: "Managed A2A",
      source: "test",
      config: {},
      runtime,
      pluginConfig: {
        enabled: false,
      },
      registerTool(tool) {
        registeredTool = tool as typeof registeredTool;
      },
    });

    plugin.register(api);

    if (!registeredTool) {
      throw new Error("managed_a2a_delegate was not registered");
    }

    const result = await registeredTool.execute("test", {
      request_id: "req_disabled",
    });

    expect(result.details).toMatchObject({
      request_id: "req_disabled",
      status: "rejected",
      error: {
        category: "policy_denied",
      },
    });
  });

  it("registers the reference Feishu adapter tool when enabled", () => {
    const registeredToolNames: string[] = [];
    const runtime = {} as OpenClawPluginApi["runtime"];

    const api = createTestPluginApi({
      id: "managed-a2a",
      name: "Managed A2A",
      source: "test",
      config: {},
      runtime,
      pluginConfig: {
        channelAdapters: {
          feishu: {
            enabled: true,
            toolName: "feishu_domain_collab_request_v2",
          },
        },
      },
      registerTool(tool) {
        registeredToolNames.push((tool as { name?: string }).name ?? "unknown");
      },
    });

    plugin.register(api);

    expect(registeredToolNames).toContain("managed_a2a_delegate");
    expect(registeredToolNames).toContain("feishu_domain_collab_request_v2");
  });

  it("registers the reference Telegram adapter tool when enabled", () => {
    const registeredToolNames: string[] = [];
    const runtime = {} as OpenClawPluginApi["runtime"];

    const api = createTestPluginApi({
      id: "managed-a2a",
      name: "Managed A2A",
      source: "test",
      config: {},
      runtime,
      pluginConfig: {
        channelAdapters: {
          telegram: {
            enabled: true,
            toolName: "telegram_domain_collab_request_v1",
          },
        },
      },
      registerTool(tool) {
        registeredToolNames.push((tool as { name?: string }).name ?? "unknown");
      },
    });

    plugin.register(api);

    expect(registeredToolNames).toContain("managed_a2a_delegate");
    expect(registeredToolNames).toContain("telegram_domain_collab_request_v1");
  });
});
