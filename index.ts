import type { AnyAgentTool, OpenClawPluginApi } from "openclaw/plugin-sdk";
import { managedA2aPluginConfigSchemaJson } from "./src/config-schema.js";
import { createManagedA2AChannelAdapters } from "./src/channel-adapters/registry.js";
import {
  MANAGED_A2A_PLUGIN_DESCRIPTION,
  MANAGED_A2A_PLUGIN_ID,
  MANAGED_A2A_PLUGIN_NAME,
} from "./src/constants.js";
import { resolveManagedA2APluginConfig } from "./src/config.js";
import { createManagedA2AChannelAdapterTool } from "./src/tools/channel-adapter-tool.js";
import { createManagedA2ADelegateTool } from "./src/tools/managed-a2a-delegate.js";

export * from "./src/constants.js";
export * from "./src/config-schema.js";
export * from "./src/config.js";
export * from "./src/protocol/types.js";
export * from "./src/protocol/schema.js";
export * from "./src/policy/validate.js";
export * from "./src/adapters/types.js";
export * from "./src/adapters/selector.js";
export * from "./src/channel-adapters/types.js";
export * from "./src/channel-adapters/registry.js";
export * from "./src/channel-adapters/feishu.js";
export * from "./src/probes/capabilities.js";

const plugin = {
  id: MANAGED_A2A_PLUGIN_ID,
  name: MANAGED_A2A_PLUGIN_NAME,
  description: MANAGED_A2A_PLUGIN_DESCRIPTION,
  configSchema: managedA2aPluginConfigSchemaJson,
  register(api: OpenClawPluginApi) {
    const config = resolveManagedA2APluginConfig(api.pluginConfig);
    api.registerTool(createManagedA2ADelegateTool(api) as unknown as AnyAgentTool, {
      optional: true,
    });

    for (const adapter of createManagedA2AChannelAdapters(config)) {
      api.registerTool(createManagedA2AChannelAdapterTool(api, adapter) as unknown as AnyAgentTool, {
        optional: true,
      });
    }
  },
};

export default plugin;
