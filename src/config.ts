import { MANAGED_A2A_DEFAULTS, type ManagedA2APreferredAdapter } from "./constants.js";

export type ManagedA2AResolvedConfig = {
  enabled: boolean;
  preferredAdapter: ManagedA2APreferredAdapter;
  allowCliFallback: boolean;
  defaultTtlSeconds: number;
  maxTtlSeconds: number;
  defaultTimeoutSeconds: number;
  auditDir?: string;
};

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function readPreferredAdapter(value: unknown): ManagedA2APreferredAdapter {
  return value === "runtime_subagent" || value === "cli_fallback" || value === "auto"
    ? value
    : MANAGED_A2A_DEFAULTS.preferredAdapter;
}

export function resolveManagedA2APluginConfig(
  raw: Record<string, unknown> | undefined,
): ManagedA2AResolvedConfig {
  const maxTtlSeconds = readPositiveInteger(raw?.maxTtlSeconds, MANAGED_A2A_DEFAULTS.maxTtlSeconds);

  const defaultTtlSeconds = Math.min(
    readPositiveInteger(raw?.defaultTtlSeconds, MANAGED_A2A_DEFAULTS.defaultTtlSeconds),
    maxTtlSeconds,
  );

  const defaultTimeoutSeconds = Math.min(
    readPositiveInteger(
      raw?.defaultTimeoutSeconds,
      MANAGED_A2A_DEFAULTS.defaultTimeoutSeconds,
    ),
    defaultTtlSeconds,
  );

  const auditDir =
    typeof raw?.auditDir === "string" && raw.auditDir.trim().length > 0
      ? raw.auditDir.trim()
      : undefined;

  return {
    enabled: readBoolean(raw?.enabled, MANAGED_A2A_DEFAULTS.enabled),
    preferredAdapter: readPreferredAdapter(raw?.preferredAdapter),
    allowCliFallback: readBoolean(raw?.allowCliFallback, MANAGED_A2A_DEFAULTS.allowCliFallback),
    defaultTtlSeconds,
    maxTtlSeconds,
    defaultTimeoutSeconds,
    ...(auditDir ? { auditDir } : {}),
  };
}
