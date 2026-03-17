import fs from "node:fs/promises";
import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { MANAGED_A2A_PLUGIN_ID } from "../constants.js";
import type { ManagedA2AResolvedConfig } from "../config.js";
import type { ManagedA2AExecutionResult, ManagedA2ARequestEnvelope } from "../protocol/types.js";
import type { ManagedA2AAuditEvent } from "./types.js";

function resolveAuditDir(api: OpenClawPluginApi, config: ManagedA2AResolvedConfig): string {
  if (config.auditDir) {
    return path.isAbsolute(config.auditDir)
      ? config.auditDir
      : path.resolve(config.auditDir);
  }

  return path.join(api.runtime.state.resolveStateDir(), MANAGED_A2A_PLUGIN_ID, "audit");
}

export async function persistManagedA2AAuditTrace(params: {
  api: OpenClawPluginApi;
  config: ManagedA2AResolvedConfig;
  request: ManagedA2ARequestEnvelope;
  result: ManagedA2AExecutionResult;
  auditEvents: ManagedA2AAuditEvent[];
}): Promise<string> {
  const auditDir = resolveAuditDir(params.api, params.config);
  const filePath = path.join(auditDir, `${params.request.request_id}.json`);

  await fs.mkdir(auditDir, { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify(
      {
        plugin_id: MANAGED_A2A_PLUGIN_ID,
        saved_at: new Date().toISOString(),
        request: params.request,
        result: params.result,
        audit_events: params.auditEvents,
      },
      null,
      2,
    ),
  );

  return filePath;
}
