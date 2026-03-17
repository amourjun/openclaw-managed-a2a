import { describe, expect, it } from "vitest";
import { resolveManagedA2APluginConfig } from "../src/config.js";
import { selectManagedA2ATransportAdapter } from "../src/adapters/selector.js";
import type { ManagedA2ATransportAdapter } from "../src/adapters/types.js";

function makeAdapter(id: ManagedA2ATransportAdapter["id"]): ManagedA2ATransportAdapter {
  return {
    id,
    label: id,
    async probe() {
      return { adapter_id: id, supported: false };
    },
    async execute() {
      throw new Error("not needed");
    },
  };
}

describe("selectManagedA2ATransportAdapter", () => {
  it("prefers the primary adapter in auto mode", () => {
    const config = resolveManagedA2APluginConfig(undefined);
    const selection = selectManagedA2ATransportAdapter({
      config,
      candidates: [
        {
          adapter: makeAdapter("runtime_subagent"),
          probe: { adapter_id: "runtime_subagent", supported: true },
        },
        {
          adapter: makeAdapter("cli_fallback"),
          probe: { adapter_id: "cli_fallback", supported: true },
        },
      ],
    });

    expect(selection.adapter?.id).toBe("runtime_subagent");
    expect(selection.used_fallback).toBe(false);
  });

  it("uses the CLI fallback when the primary adapter is unavailable", () => {
    const config = resolveManagedA2APluginConfig(undefined);
    const selection = selectManagedA2ATransportAdapter({
      config,
      candidates: [
        {
          adapter: makeAdapter("runtime_subagent"),
          probe: { adapter_id: "runtime_subagent", supported: false },
        },
        {
          adapter: makeAdapter("cli_fallback"),
          probe: { adapter_id: "cli_fallback", supported: true },
        },
      ],
    });

    expect(selection.adapter?.id).toBe("cli_fallback");
    expect(selection.used_fallback).toBe(true);
  });

  it("fails closed when no adapter is supported", () => {
    const config = resolveManagedA2APluginConfig({
      preferredAdapter: "auto",
      allowCliFallback: false,
    });
    const selection = selectManagedA2ATransportAdapter({
      config,
      candidates: [
        {
          adapter: makeAdapter("runtime_subagent"),
          probe: { adapter_id: "runtime_subagent", supported: false },
        },
        {
          adapter: makeAdapter("cli_fallback"),
          probe: { adapter_id: "cli_fallback", supported: false },
        },
      ],
    });

    expect(selection.adapter).toBeUndefined();
    expect(selection.reason).toContain("No supported");
  });
});
