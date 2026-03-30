# Shadow Profile

This document describes the recommended isolated validation path for `openclaw-managed-a2a`.

## Why

Use a shadow profile when you want to validate the plugin against a real OpenClaw runtime without:

- receiving real Feishu inbound traffic
- polluting your main or trading instance state
- coupling validation to production bindings, hooks, or channel credentials

## What It Creates

The helper script creates:

- a dedicated OpenClaw profile such as `managed-a2a-shadow`
- isolated workspaces under `~/clawd-managed-a2a-shadow`
- two local shadow agents for delegation validation
- a fake Feishu-style registry for adapter resolution only
- a local linked plugin install that points at your working checkout
- a loopback-only gateway config on a dedicated port

It intentionally does **not** copy:

- real `channels.feishu` config
- production `bindings`
- production `hooks`
- real chat routing

It also adds `tools.allow: ["managed-a2a"]` to the shadow `main` agent and the two shadow domain agents, because the plugin registers its tools as `optional: true`.

## Default Layout

With the default arguments, the script provisions:

| Item | Value |
|---|---|
| Profile | `managed-a2a-shadow` |
| State dir | `~/.openclaw-managed-a2a-shadow` |
| Config | `~/.openclaw-managed-a2a-shadow/openclaw.json` |
| Workspace root | `~/clawd-managed-a2a-shadow` |
| Gateway port | `18809` |
| Registry path | `~/.openclaw-managed-a2a-shadow/domain-agent/feishu-domain-registry.json` |

## Create the Profile

From the repository root:

```bash
node scripts/setup-shadow-profile.mjs
```

Optional overrides:

```bash
node scripts/setup-shadow-profile.mjs \
  --profile managed-a2a-shadow \
  --port 18809 \
  --workspace-root ~/clawd-managed-a2a-shadow
```

Package script:

```bash
npm run smoke:shadow:setup
```

## Validate the Result

Config and plugin discovery:

```bash
openclaw --profile managed-a2a-shadow config validate --json
openclaw --profile managed-a2a-shadow plugins list --json --verbose
```

Expected plugin result:

- `managed-a2a` is `loaded`
- `toolNames` includes `managed_a2a_delegate`
- `toolNames` includes `managed_a2a_feishu_delegate`

Expected agent allowlist result:

- `agents.list[*].tools.allow` includes `managed-a2a` for `main`
- `agents.list[*].tools.allow` includes `managed-a2a` for the two shadow domain agents

## Start the Shadow Gateway

Foreground:

```bash
openclaw --profile managed-a2a-shadow gateway run --port 18809
```

If you want a service-managed instance instead:

```bash
openclaw --profile managed-a2a-shadow gateway install --port 18809
openclaw --profile managed-a2a-shadow gateway start
```

## Minimal Smoke Path

The shadow profile includes fake chat IDs for adapter validation:

- requester chat: `oc_shadow_dsp_5df9b085`
- target agent: `domain-multimedia-ops-d7ec4d33`

When your local build does not expose a direct `openclaw tools call` command, use one of these two smoke paths.

Gateway-backed primary path:

```bash
openclaw --profile managed-a2a-shadow gateway run --port 18809
```

In another shell:

```bash
openclaw --profile managed-a2a-shadow agent --agent main --json --message \
  "Use the managed_a2a_feishu_delegate tool with chat_id oc_shadow_dsp_5df9b085, target_agent_id domain-multimedia-ops-d7ec4d33, question Health check: reply only OK. Return the raw tool result only."
```

Expected result:

- `diagnostics.adapter_id` is `runtime_subagent`
- `managed_status` is `completed`
- `reply` is `OK`

Embedded fallback path:

```bash
openclaw --profile managed-a2a-shadow agent --local --agent main --json --message \
  "Use the managed_a2a_feishu_delegate tool with chat_id oc_shadow_dsp_5df9b085, target_agent_id domain-multimedia-ops-d7ec4d33, question Health check: reply only OK. Return the raw tool result only."
```

Expected result:

- `diagnostics.adapter_id` is `cli_fallback`
- `managed_status` is `degraded`
- `reply` is `OK`

What these validate:

- the plugin loads from the linked local checkout
- the Feishu reference adapter resolves requester context from the fake registry
- the adapter normalizes into the core managed-a2a request path
- the target local agent is reachable in the same shadow profile
- audit traces are written to the configured shadow audit directory

## One-Command Verification

To run the full acceptance check with one command:

```bash
npm run smoke:shadow
```

What the script does:

- validates the shadow config
- confirms the plugin is loaded and exposes both required tools
- starts a fresh shadow gateway on `18809`
- runs one gateway-backed primary-path smoke
- runs one embedded local fallback smoke with an isolated session id
- verifies the expected adapter path, result status, reply text, and audit file for both calls

Expected success output:

- `passed: true`
- `primary.adapter_id: runtime_subagent`
- `primary.managed_status: completed`
- `local.adapter_id: cli_fallback`
- `local.managed_status: degraded`

The script stops the gateway it started unless you pass:

```bash
node scripts/verify-shadow-smoke.mjs --keep-gateway
```

## Negative Verification

To verify fail-closed and adapter-side failure behavior:

```bash
npm run smoke:shadow:negative
```

This script verifies:

- unresolved Feishu target returns `status=ask_clarify`
- unresolved requester returns `error_code=RESOLUTION_FAILED`
- loop detection returns `status=rejected`
- invalid timeout contract returns `status=failed`

To run both the positive and negative suites together:

```bash
npm run smoke:shadow:full
```

## Acceptance Checklist

- `openclaw --profile managed-a2a-shadow config validate --json` returns `valid=true`
- `plugins list --json --verbose` shows `managed-a2a` as `loaded`
- `managed_a2a_delegate` is present in plugin toolNames
- `managed_a2a_feishu_delegate` is present in plugin toolNames
- gateway-backed smoke returns `managed_status=completed`
- gateway-backed smoke returns `adapter_id=runtime_subagent`
- gateway-backed smoke returns `reply=OK`
- embedded smoke returns `managed_status=degraded`
- embedded smoke returns `adapter_id=cli_fallback`
- embedded smoke returns `reply=OK`
- both smoke calls write audit files
- unresolved target returns `decision_reason=target_unresolved`
- requester resolution failure returns `error_code=RESOLUTION_FAILED`
- loop detection returns `status=rejected`
- invalid timeout contract returns `status=failed`

## Linked Checkout Warning

When the linked directory name is `openclaw-managed-a2a`, OpenClaw currently emits a warning like:

```text
plugin id mismatch (manifest uses "managed-a2a", entry hints "openclaw-managed-a2a")
```

This warning is expected for the current linked-checkout workflow and does not block loading or execution.

## Isolation Notes

This setup is intentionally conservative:

- fake chat IDs are local-only and never map to real Feishu traffic
- the shadow profile has no `channels.feishu` section
- the shadow registry is local to the profile
- the workspaces are separate from your main and trading domain workspaces

If you later want channel-specific validation for Telegram or another IM, add a new adapter-specific local registry rather than reusing production channel bindings.
