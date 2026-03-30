import type { ManagedA2AResolvedConfig } from "../config.js";
import type { ManagedA2AChannelAdapter } from "./types.js";
import { createManagedA2AFeishuAdapter } from "./feishu.js";

export function createManagedA2AChannelAdapters(
  config: ManagedA2AResolvedConfig,
): ManagedA2AChannelAdapter[] {
  const adapters: ManagedA2AChannelAdapter[] = [];

  if (config.channelAdapters.feishu.enabled) {
    adapters.push(createManagedA2AFeishuAdapter(config.channelAdapters.feishu));
  }

  return adapters;
}
