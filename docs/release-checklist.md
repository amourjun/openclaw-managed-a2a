# Release Checklist

Use this checklist before cutting a public release of `openclaw-managed-a2a`.

## 1. Repository Validation

Run:

```bash
npm ci
npm run ci
```

Expected result:

- typecheck passes
- tests pass
- OpenSpec validation passes
- `npm pack --dry-run` succeeds and includes the intended files only
- if `.github/**` changed, the GitHub metadata validation workflow should also be green on the pull request

## 2. Smoke Test Against a Real OpenClaw Instance

Follow:

- [`./smoke-test.md`](./smoke-test.md)
- [`./shadow-profile.md`](./shadow-profile.md)

Confirm:

- `npm run smoke:shadow` passes end-to-end
- `npm run smoke:shadow:negative` passes end-to-end
- `runtime_subagent` path works in a normal trusted intra-instance deployment
- CLI fallback path still works when forced
- audit files are written and readable
- failure cases remain normalized and fail closed
- example config still matches the currently supported OpenClaw config shape
- caller agents explicitly allow `managed-a2a` when using optional tool registration

## 3. Compatibility Review

Before release, review:

- current peer dependency range in `package.json`
- current plugin config schema in `openclaw.plugin.json`
- current runtime adapter assumptions in `src/adapters/runtime-subagent.ts`
- current compatibility notes in [`./compatibility.md`](./compatibility.md)

## 4. Package Surface Review

Confirm the tarball contains:

- plugin entrypoint
- `src/` sources
- docs needed by users
- example config
- `openclaw.plugin.json`
- `README.md`
- `LICENSE`

Confirm the tarball does not accidentally include:

- `node_modules/`
- local audit outputs
- editor files
- private config or credentials
- test fixtures that should not ship

## 5. Release Metadata

Before tagging or publishing, confirm:

- version in `package.json`
- repository URLs in `package.json`
- README installation instructions
- changelog or release notes summary
- supported OpenClaw version range
- npm publish path is ready
- release rehearsal notes have been reviewed if this is the first cut of a new release line
- any draft release notes document for the target version has been updated if you are using one

For npm-specific steps, follow:

- [`./publish-npm.md`](./publish-npm.md)
- [`./release-rehearsal.md`](./release-rehearsal.md)
- [`./release-draft-0.1.0-alpha.4.md`](./release-draft-0.1.0-alpha.4.md)

## 6. Post-Release Checks

After release, verify:

- the published package installs cleanly
- the example config still matches the published layout
- GitHub issue templates, compatibility form, and security policy are still visible
- Dependabot is still configured for both npm and GitHub Actions updates
- the label sync workflow still matches [`.github/labels.json`](../.github/labels.json)
- generated GitHub release notes are categorized sensibly through [`.github/release.yml`](../.github/release.yml)
- operators can reproduce the smoke test with the released artifact
