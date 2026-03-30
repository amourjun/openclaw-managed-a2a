import type { TSchema } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { ManagedA2AResolvedConfig } from "../config.js";
import type { ManagedA2AError } from "../errors.js";
import type { ManagedA2AExecutionResult, ManagedA2ARequestEnvelope } from "../protocol/types.js";

export type ManagedA2AChannelAdapterNormalization =
  | {
      kind: "delegate";
      request: Record<string, unknown>;
      state?: Record<string, unknown>;
    }
  | {
      kind: "terminal";
      payload: Record<string, unknown>;
    };

export type ManagedA2AChannelAdapter = {
  id: string;
  toolName: string;
  label: string;
  description: string;
  parameters: TSchema;
  normalize: (params: {
    api: OpenClawPluginApi;
    config: ManagedA2AResolvedConfig;
    rawParams: Record<string, unknown>;
  }) => Promise<ManagedA2AChannelAdapterNormalization> | ManagedA2AChannelAdapterNormalization;
  mapResult?: (params: {
    api: OpenClawPluginApi;
    config: ManagedA2AResolvedConfig;
    result: ManagedA2AExecutionResult;
    request: ManagedA2ARequestEnvelope;
    state?: Record<string, unknown>;
  }) => Record<string, unknown>;
  mapError?: (params: {
    api: OpenClawPluginApi;
    config: ManagedA2AResolvedConfig;
    error: ManagedA2AError;
    requestId: string;
    rawParams: Record<string, unknown>;
    normalizedRequest?: Record<string, unknown>;
    request?: ManagedA2ARequestEnvelope;
    state?: Record<string, unknown>;
  }) => Record<string, unknown>;
};
