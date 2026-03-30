# Publish to npm

This repository is prepared for npm publishing, but actual publishing still requires npm-side authorization.

## Current State

- npm package name: `openclaw-managed-a2a`
- current version: `0.1.0-alpha.4`
- npm availability and auth status should be verified at release time

## Recommended Path

Current default is manual publish.

Use GitHub Actions trusted publishing once GitHub Actions billing lock is resolved.

The repository already includes:

- [`.github/workflows/publish-npm.yml`](../.github/workflows/publish-npm.yml)
- [`.github/workflows/release.yml`](../.github/workflows/release.yml)

### What the publish workflow does

1. installs dependencies
2. runs `npm run ci`
3. resolves an npm dist-tag
4. runs `npm publish --provenance --access public`

Dist-tag behavior:

- workflow dispatch -> uses the provided `dist_tag`

Current dist-tags (after `0.1.0-alpha.4`):

- `alpha` -> `0.1.0-alpha.4`
- `latest` -> `0.1.0-alpha.4`

## Prerequisites

Before the workflow can publish successfully:

1. GitHub Actions must be usable for the repository account
2. npm trusted publishing must be configured for this package, or you must use a manual publish path
3. the version in `package.json` must not already exist on npm

## Manual Publish Path

This is the active path right now.

If you want to publish manually from a local machine:

```bash
npm login
npm run ci
npm publish --access public --tag alpha
```

For a stable release:

```bash
npm publish --access public --tag latest
```

If you want provenance in a local flow, prefer the GitHub Actions path instead.

If your npm account uses security keys for 2FA, npm CLI may require an interactive browser verification URL during publish or dist-tag updates.

## Suggested Version Flow

- `0.1.0-alpha.x` for early repository and integration validation
- `0.1.0-beta.x` once real OpenClaw installs are validated repeatedly
- `0.1.0` when the public installation and compatibility story is stable

## Dist-Tag Policy

- During pre-`1.0.0`, `alpha` always points to the newest pre-release.
- `latest` may be manually promoted to the newest pre-release when maintainers want default installs to track the active alpha line.
- Once the first stable `0.1.0` is published, `latest` should only track stable releases.

## Release Sequence

Recommended order:

1. update version and changelog
2. update or review the draft release notes document if you are using one
3. run `npm run ci`
4. rehearse the tag and artifact flow using [`./release-rehearsal.md`](./release-rehearsal.md)
5. create and push the release commit
6. create and push a `v*` tag
7. publish GitHub release
8. publish to npm using either the workflow or manual fallback

Current draft release notes reference:

- [`./release-draft-0.1.0-alpha.4.md`](./release-draft-0.1.0-alpha.4.md)

## Current Blocker

At the moment, repository Actions are blocked by the GitHub account billing issue, so `publish-npm` is configured as manual-dispatch only and release cuts should use the manual publish path.

Observed on `v0.1.0-alpha.4`:

- GitHub Actions run `Publish npm` was rejected before job start with billing-lock annotation
- release and npm publish were completed manually as fallback
