import { Type, type Static } from "@sinclair/typebox";
import { MANAGED_A2A_DEFAULTS, managedA2APreferredAdapters } from "./constants.js";

const ManagedA2AFeishuAdapterConfigSchema = Type.Object(
  {
    enabled: Type.Optional(
      Type.Boolean({ default: MANAGED_A2A_DEFAULTS.channelAdapters.feishu.enabled }),
    ),
    registryPath: Type.Optional(Type.String()),
    toolName: Type.Optional(
      Type.String({ default: MANAGED_A2A_DEFAULTS.channelAdapters.feishu.toolName }),
    ),
  },
  { additionalProperties: false },
);

const ManagedA2ATelegramAdapterConfigSchema = Type.Object(
  {
    enabled: Type.Optional(
      Type.Boolean({ default: MANAGED_A2A_DEFAULTS.channelAdapters.telegram.enabled }),
    ),
    toolName: Type.Optional(
      Type.String({ default: MANAGED_A2A_DEFAULTS.channelAdapters.telegram.toolName }),
    ),
  },
  { additionalProperties: false },
);

export const ManagedA2APluginConfigSchema = Type.Object(
  {
    enabled: Type.Optional(Type.Boolean({ default: MANAGED_A2A_DEFAULTS.enabled })),
    preferredAdapter: Type.Optional(
      Type.Union(
        managedA2APreferredAdapters.map((value) => Type.Literal(value)),
        { default: MANAGED_A2A_DEFAULTS.preferredAdapter },
      ),
    ),
    allowCliFallback: Type.Optional(
      Type.Boolean({ default: MANAGED_A2A_DEFAULTS.allowCliFallback }),
    ),
    defaultTtlSeconds: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 3600,
        default: MANAGED_A2A_DEFAULTS.defaultTtlSeconds,
      }),
    ),
    maxTtlSeconds: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 3600,
        default: MANAGED_A2A_DEFAULTS.maxTtlSeconds,
      }),
    ),
    defaultTimeoutSeconds: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 3600,
        default: MANAGED_A2A_DEFAULTS.defaultTimeoutSeconds,
      }),
    ),
    auditDir: Type.Optional(Type.String()),
    channelAdapters: Type.Optional(
      Type.Object(
        {
          feishu: Type.Optional(ManagedA2AFeishuAdapterConfigSchema),
          telegram: Type.Optional(ManagedA2ATelegramAdapterConfigSchema),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export type ManagedA2APluginConfigInput = Static<typeof ManagedA2APluginConfigSchema>;

export const managedA2aPluginConfigSchemaJson = {
  type: "object",
  additionalProperties: false,
  properties: {
    enabled: { type: "boolean" },
    preferredAdapter: { type: "string", enum: [...managedA2APreferredAdapters] },
    allowCliFallback: { type: "boolean" },
    defaultTtlSeconds: { type: "integer", minimum: 1, maximum: 3600 },
    maxTtlSeconds: { type: "integer", minimum: 1, maximum: 3600 },
    defaultTimeoutSeconds: { type: "integer", minimum: 1, maximum: 3600 },
    auditDir: { type: "string" },
    channelAdapters: {
      type: "object",
      additionalProperties: false,
      properties: {
        feishu: {
          type: "object",
          additionalProperties: false,
          properties: {
            enabled: { type: "boolean" },
            registryPath: { type: "string" },
            toolName: { type: "string" },
          },
        },
        telegram: {
          type: "object",
          additionalProperties: false,
          properties: {
            enabled: { type: "boolean" },
            toolName: { type: "string" },
          },
        },
      },
    },
  },
} as const;
