# Release Rehearsal

Use this document to rehearse the first public tag and release flow before you actually push a release tag.

This is intentionally a dry-run-oriented guide. It verifies that:

- version and changelog updates are coherent
- repository validation still passes
- the npm tarball looks correct
- the tag name and release notes input are ready

It does not publish to npm by itself.

## When to Use This

Run a rehearsal when:

- you are preparing the first public release line
- you changed release automation or package surface
- you upgraded OpenClaw support and want one end-to-end maintainer check

## Recommended Rehearsal Branch

Use a short-lived branch so the rehearsal does not pollute `main`.

```bash
git switch -c codex/release-rehearsal
```

If you are already on the intended release branch, you can stay there.

## Rehearsal Steps

### 1. Choose the Version

Pick the exact candidate version before you touch tags.

Examples:

- `0.1.0-alpha.4`
- `0.1.0-beta.1`
- `0.1.0`

### 2. Update Release Metadata

Apply the candidate version locally without creating a tag yet:

```bash
npm version 0.1.0-alpha.4 --no-git-tag-version
```

Then update:

- `CHANGELOG.md`
- any release notes draft you plan to use
- any docs that mention the current version explicitly

### 3. Run Full Validation

```bash
npm ci
npm run ci
npm run smoke:shadow:full
```

If the release is intended to support a newer OpenClaw build, attach that exact version to the rehearsal notes.

### 4. Inspect the Package Artifact

Preview and then build the tarball locally:

```bash
npm pack --dry-run
rm -f openclaw-managed-a2a-*.tgz
npm pack
```

Check:

- tarball name matches the candidate version
- docs and example config are included
- no local audit output or private files are included

### 5. Rehearse the Tag

Create the tag locally only:

```bash
git tag -a v0.1.0-alpha.4 -m "v0.1.0-alpha.4"
git tag -n1 v0.1.0-alpha.4
```

This verifies the exact tag shape that the release workflow expects.

If this is still a rehearsal and you do not want to keep the tag yet:

```bash
git tag -d v0.1.0-alpha.4
```

### 6. Decide Whether to Proceed

Proceed to a real release only if all of the following are true:

- `npm run ci` passed
- `npm run smoke:shadow:full` passed
- tarball contents are correct
- changelog text is acceptable
- tag name is final

## Real Release Path After Rehearsal

Once the rehearsal is satisfactory:

1. commit the version and changelog updates
2. push the release branch or `main`
3. create and push the final `v*` tag
4. watch the GitHub `Release` workflow
5. trigger or confirm the npm publish path described in [`./publish-npm.md`](./publish-npm.md)

## Notes for This Repository

- The `Release` workflow is triggered by pushing a `v*` tag.
- The npm publish workflow can publish either from a release event or manual dispatch.
- The repository currently keeps release automation in GitHub Actions, but you should still rehearse the local artifact and tag shape first.
