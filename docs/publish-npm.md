# Publish to npm

This repository is prepared for npm publishing, but actual publishing still requires npm-side authorization.

## Current State

- npm package name: `openclaw-managed-a2a`
- current version: `0.1.0-alpha.1`
- package name is currently not taken on npm
- this machine is not logged in to npm right now

## Recommended Path

Prefer GitHub Actions trusted publishing once GitHub Actions is available for the repository account again.

The repository already includes:

- [`.github/workflows/publish-npm.yml`](../.github/workflows/publish-npm.yml)
- [`.github/workflows/release.yml`](../.github/workflows/release.yml)

### What the publish workflow does

1. installs dependencies
2. runs `npm run ci`
3. resolves an npm dist-tag
4. runs `npm publish --provenance --access public`

Dist-tag behavior:

- release prerelease -> `alpha`
- release stable -> `latest`
- manual workflow dispatch -> uses the provided `dist_tag`

## Prerequisites

Before the workflow can publish successfully:

1. GitHub Actions must be usable for the repository account
2. npm trusted publishing must be configured for this package, or you must use a manual publish path
3. the version in `package.json` must not already exist on npm

## Manual Publish Path

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

## Suggested Version Flow

- `0.1.0-alpha.x` for early repository and integration validation
- `0.1.0-beta.x` once real OpenClaw installs are validated repeatedly
- `0.1.0` when the public installation and compatibility story is stable

## Release Sequence

Recommended order:

1. update version and changelog
2. run `npm run ci`
3. create and push the release commit
4. create and push a `v*` tag
5. publish GitHub release
6. publish to npm using either the workflow or manual fallback

## Current Blocker

At the moment, repository Actions are blocked by the GitHub account billing issue, so the workflow is configured but will not execute until that account issue is resolved.
