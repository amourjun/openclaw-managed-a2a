# Smoke Test

This document gives the shortest practical path to validate the plugin in a real OpenClaw environment.

If you want a clean local validation environment first, create the isolated profile described in:

- [`docs/shadow-profile.md`](./shadow-profile.md)

If you want a one-command acceptance run for that isolated profile, use:

```bash
npm run smoke:shadow
```

## Prerequisites

- OpenClaw `2026.3.13`
- a local checkout of `openclaw-managed-a2a`
- at least two local agents already available in the same OpenClaw instance
- the target agent should be reachable as `agent:<target_agent_id>:main`

## 1. Install the Plugin Locally

Recommended local install:

```bash
openclaw plugins install -l /absolute/path/to/openclaw-managed-a2a
```

If you prefer to manage the config manually, use a config shape like this:

```jsonc
{
  "plugins": {
    "enabled": true,
    "allow": ["managed-a2a"],
    "load": {
      "paths": ["/absolute/path/to/openclaw-managed-a2a"]
    },
    "entries": {
      "managed-a2a": {
        "enabled": true,
        "config": {
          "enabled": true,
          "preferredAdapter": "auto",
          "allowCliFallback": true,
          "defaultTtlSeconds": 30,
          "maxTtlSeconds": 300,
          "defaultTimeoutSeconds": 20,
          "channelAdapters": {
            "feishu": {
              "enabled": false,
              "toolName": "managed_a2a_feishu_delegate",
              "registryPath": "~/.openclaw/domain-agent/feishu-domain-registry.json"
            }
          }
        }
      }
    }
  },
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": {
          "allow": ["managed-a2a"]
        }
      }
    ]
  }
}
```

Important:

- `managed-a2a` tools are registered with `optional: true`
- if the caller agent does not allow `managed-a2a`, the tool will not appear in the agent tool list even though the plugin is loaded

Then restart the gateway so the plugin is loaded.

## 2. Check Local Validation First

From the repository root:

```bash
npm ci
npm run ci
```

Expected result:

- `typecheck` passes
- `vitest` passes
- `openspec validate --all --strict` passes

## 3. Happy-Path Delegation Test

In one shell, start or restart the gateway:

```bash
openclaw gateway run --force
```

In another shell, use a bounded one-shot request against a known local target agent.

For OpenClaw builds like `2026.3.13` that do not expose a direct `openclaw tools call` CLI, drive the tool through an agent turn:

```bash
openclaw agent --agent main --session-id managed-a2a-smoke-primary --json --message \
  'Use the managed_a2a_delegate tool with requester_agent_id domain-dsp-ops, target_agent_id domain-multimedia-ops, question Health check: reply only OK., mode orchestrated_internal, ttl_seconds 30, hop 1, visited_agents ["domain-dsp-ops"], publish_contract evidence_only, external_announce forbidden, timeout_seconds 20. Return the raw tool result only.'
```

If your OpenClaw build does expose a direct tool-call CLI, you may use an equivalent direct call such as:

```bash
openclaw tools call managed_a2a_delegate --json --params '{
  "request_id": "smoke_req_001",
  "requester_agent_id": "domain-dsp-ops",
  "target_agent_id": "domain-multimedia-ops",
  "question": "Health check: reply only OK",
  "mode": "orchestrated_internal",
  "ttl_seconds": 30,
  "hop": 1,
  "visited_agents": ["domain-dsp-ops"],
  "publish_contract": "evidence_only",
  "external_announce": "forbidden",
  "timeout_seconds": 20
}'
```

Expected result:

- `managed_status` is `completed` when `runtime_subagent` is available
- `managed_status` is `degraded` when the CLI fallback path is used
- `reply` is `OK`
- `diagnostics.adapter_id` is either `runtime_subagent` or `cli_fallback`

## 4. Inspect the Audit Trace

By default the plugin writes audit files under:

```text
~/.openclaw/managed-a2a/audit/
```

The result payload also includes:

- `audit_ref`
- `diagnostics.audit_events`
- `diagnostics.details.audit_path`

Open the saved JSON file and verify that it includes:

- request envelope
- final result
- lifecycle events such as `accepted`, `dispatched`, `completed`, `failed`, or `expired`

## 5. Degraded-Path Test

Force the fallback path by setting:

```jsonc
{
  "plugins": {
    "entries": {
      "managed-a2a": {
        "config": {
          "preferredAdapter": "cli_fallback",
          "allowCliFallback": true
        }
      }
    }
  }
}
```

Then repeat the same request.

Expected result:

- `managed_status` is `degraded`
- `diagnostics.adapter_id` is `cli_fallback`
- audit trace still exists and records the degraded path explicitly

## 6. Fail-Closed Checks

Try these negative cases:

1. set `visited_agents` to include the target agent
2. set `timeout_seconds` greater than `ttl_seconds`
3. disable the plugin with `"enabled": false`

Expected result:

- invalid or denied requests return normalized failure categories
- unsupported or unavailable transport returns actionable diagnostics
- policy failures are not misreported as generic execution failures

## 7. Reference Feishu Adapter Smoke Test

When you want to validate the adapter SPI above the same core path, enable the Feishu reference adapter:

```jsonc
{
  "plugins": {
    "entries": {
      "managed-a2a": {
        "config": {
          "channelAdapters": {
            "feishu": {
              "enabled": true,
              "toolName": "managed_a2a_feishu_delegate",
              "registryPath": "~/.openclaw/domain-agent/feishu-domain-registry.json"
            }
          }
        }
      }
    }
  }
}
```

Then call the adapter-facing wrapper.

For OpenClaw builds without direct tool-call CLI support, use:

```bash
openclaw agent --agent main --session-id managed-a2a-smoke-feishu --json --message \
  'Use the managed_a2a_feishu_delegate tool with chat_id oc_requester_chat_id, target_agent_id domain-multimedia-ops, question Health check: reply only OK. Return the raw tool result only.'
```

If your build supports direct tool calls, an equivalent call is:

```bash
openclaw tools call managed_a2a_feishu_delegate --json --params '{
  "request_id": "feishu_smoke_req_001",
  "chat_id": "oc_requester_chat_id",
  "target_agent_id": "domain-multimedia-ops",
  "question": "Health check: reply only OK"
}'
```

Expected result:

- the adapter resolves requester and source context from Feishu-style input
- the result still comes back through the same core managed-a2a execution path
- successful output returns a compatibility-oriented payload such as `status=ok`, `reply`, `request_id`, and `target_agent_id`
- adapter-side resolution problems are reported as adapter failures rather than transport failures

## 8. Session-Lock Note

Avoid running multiple smoke calls against the same agent session at the same time.

If you need parallel manual verification:

- give each run its own `--session-id`
- or serialize the calls

Otherwise you may hit OpenClaw session lock errors that are unrelated to managed-a2a behavior.
