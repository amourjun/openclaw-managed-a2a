export const MANAGED_A2A_PACKAGE_NAME = "openclaw-managed-a2a";
export const MANAGED_A2A_PLUGIN_ID = "managed-a2a";
export const MANAGED_A2A_PLUGIN_NAME = "Managed A2A";
export const MANAGED_A2A_PLUGIN_DESCRIPTION =
  "Governed single-turn delegation for trusted intra-instance domain-agent deployments";
export const MANAGED_A2A_DELEGATE_TOOL_NAME = "managed_a2a_delegate";
export const MANAGED_A2A_FEISHU_ADAPTER_ID = "feishu";
export const MANAGED_A2A_FEISHU_DELEGATE_TOOL_NAME = "managed_a2a_feishu_delegate";
export const MANAGED_A2A_SUPPORTED_OPENCLAW_RANGE = ">=2026.3.13 <2026.4.0";

export const managedA2APreferredAdapters = [
  "auto",
  "runtime_subagent",
  "cli_fallback",
] as const;

export type ManagedA2APreferredAdapter = (typeof managedA2APreferredAdapters)[number];

export const MANAGED_A2A_DEFAULTS = {
  enabled: true,
  preferredAdapter: "auto" as ManagedA2APreferredAdapter,
  allowCliFallback: true,
  defaultTtlSeconds: 30,
  maxTtlSeconds: 300,
  defaultTimeoutSeconds: 20,
  channelAdapters: {
    feishu: {
      enabled: false,
      toolName: MANAGED_A2A_FEISHU_DELEGATE_TOOL_NAME,
    },
  },
};
