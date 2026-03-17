# Smoke Test

This document gives the shortest practical path to validate the plugin in a real OpenClaw environment.

## Prerequisites

- OpenClaw `2026.3.13`
- a local checkout of `openclaw-managed-a2a`
- at least two local agents already available in the same OpenClaw instance
- the target agent should be reachable as `agent:<target_agent_id>:main`

## 1. Install the Plugin Locally

Add a plugin entry to your OpenClaw config:

```jsonc
{
  "plugins": {
    "entries": {
      "managed-a2a": {
        "source": "/absolute/path/to/openclaw-managed-a2a",
        "config": {
          "enabled": true,
          "preferredAdapter": "auto",
          "allowCliFallback": true,
          "defaultTtlSeconds": 30,
          "maxTtlSeconds": 300,
          "defaultTimeoutSeconds": 20
        }
      }
    }
  }
}
```

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

Use a bounded one-shot request against a known local target agent:

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

- status is `completed` when `runtime_subagent` is available
- status is `degraded` when the CLI fallback path is used
- `evidence.text` contains the extracted target reply
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

- status is `degraded`
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
