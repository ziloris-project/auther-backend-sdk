# Releasing

Each language SDK releases independently from CI.

## Node (`@auther-sdk/node`)

1. Bump the `version` in [`node/package.json`](./node/package.json) in your PR.
2. Merge to `main` to publish that version to npm.

Publishing uses npm trusted publishing (OIDC), so no tokens are required.
