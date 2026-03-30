import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { describe, expect, it } from "vitest";
import plugin from "../index.js";
import { createTestPluginApi } from "./test-plugin-api.js";

function registerTelegramTool(params?: { toolName?: string }) {
  let registeredTool:
    | { name?: string; execute: (id: string, rawParams: Record<string, unknown>) => Promise<any> }
    | undefined;

  const api = createTestPluginApi({
    id: "managed-a2a",
    name: "Managed A2A",
    source: "test",
    config: {},
    runtime: {} as OpenClawPluginApi["runtime"],
    pluginConfig: {
      channelAdapters: {
        telegram: {
          enabled: true,
          ...(params?.toolName ? { toolName: params.toolName } : {}),
        },
      },
    },
    registerTool(tool) {
      if ((tool as { name?: string }).name === (params?.toolName ?? "managed_a2a_telegram_delegate")) {
        registeredTool = tool as typeof registeredTool;
      }
    },
  });

  plugin.register(api);
  if (!registeredTool) {
    throw new Error("Telegram adapter tool was not registered");
  }
  return registeredTool;
}

describe("managed-a2a Telegram channel adapter", () => {
  it("supports dry_run without dispatching to the core transport", async () => {
    const tool = registerTelegramTool();

    const result = await tool.execute("tool-1", {
      request_id: "req_telegram_dry_001",
      requester_agent_id: "domain-dsp-ops",
      target_agent_id: "domain-multimedia-ops",
      chat_id: "tg_room_001",
      question: "Health check: reply only OK",
      dry_run: true,
    });

    expect(result.details).toMatchObject({
      status: "dry_run",
      request_id: "req_telegram_dry_001",
      source_channel: "telegram",
      requester_agent_id: "domain-dsp-ops",
      target_agent_id: "domain-multimedia-ops",
      target_session_key: "agent:domain-multimedia-ops:main",
    });
    expect(result.details.normalized_request).toMatchObject({
      mode: "orchestrated_internal",
      publish_contract: "evidence_only",
      external_announce: "forbidden",
    });
  });

  it("returns resolution_failed when target cannot be inferred", async () => {
    const tool = registerTelegramTool();

    const result = await tool.execute("tool-2", {
      request_id: "req_telegram_err_001",
      requester_agent_id: "domain-dsp-ops",
      question: "Health check: reply only OK",
    });

    expect(result.details).toMatchObject({
      status: "error",
      request_id: "req_telegram_err_001",
      source_channel: "telegram",
      error_code: "RESOLUTION_FAILED",
      diagnostics: {
        category: "resolution_failed",
      },
    });
  });
});
