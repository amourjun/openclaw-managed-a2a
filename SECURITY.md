# Security Policy

## Supported Versions

This project is currently pre-release. Until a stable release line exists, security fixes are handled on the default branch only.

## Reporting a Vulnerability

Please do not open a public issue for a suspected security vulnerability.

Use one of these channels instead:

- GitHub private vulnerability reporting, if enabled for this repository
- Direct contact to the maintainer via GitHub: `@amourjun`

Please include:

- affected commit, branch, or version
- steps to reproduce
- expected versus actual behavior
- impact assessment if known
- any logs, traces, or proof-of-concept details needed to verify the issue

We will aim to:

- acknowledge receipt promptly
- confirm severity and affected scope
- coordinate a fix and disclosure path

## Scope

Security-sensitive areas for this project include:

- transport authorization and scope handling
- cross-agent request spoofing or replay risks
- publish restriction bypass
- audit trail tampering or omission
- compatibility shims that invoke non-public OpenClaw runtime entrypoints
