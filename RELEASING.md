# Releasing

How the backend SDKs get published. Each language is independent, so each
has its own release path. Today that means the Node package.

## Node (`@auther-sdk/node`)

### TL;DR

1. In your PR, bump the `version` in [`node/package.json`](./node/package.json).
2. Merge to `main`.
3. CI publishes that version to npm automatically.

No one runs `npm publish` by hand. There are no npm tokens anywhere.

### How authentication works

Publishing uses npm **OIDC Trusted Publishing**. GitHub Actions proves the workflow's identity to npm with a short-lived OpenID Connect token, checked against the Trusted Publisher registered for the package. No long-lived token exists, so there is nothing to leak or rotate.

Configured once on npmjs.com (package Settings, Trusted Publisher):

| Package | Org | Repo | Workflow |
|---|---|---|---|
| @auther-sdk/node | ziloris-project | auther-backend-sdk | release.yml |

Requirements the workflow already satisfies: `id-token: write` permission, npm 11.5.1 or newer, Node 22.14 or newer, and `registry-url` set to the npm registry.

### The model

There are no changesets here. The `version` field in `node/package.json` is the single source of truth. On every push to `main` that touches `node/**`, `release.yml` builds and typechecks the package, then:

- If that exact version is already on npm, it does nothing.
- If the version is new, it runs `npm publish --provenance`, which publishes with a signed sigstore attestation.

So a release is simply: bump the version in a PR, merge it. A merge that does not change the version republishes nothing.

### Triggering a release manually

The workflow accepts a manual run (Actions tab, "Release (node)", Run workflow). It behaves the same: publish if the current version is new, otherwise skip.

## Adding another language later

Create a new top-level directory (for example `python/` or `go/`) with its own build and its own CI and release jobs. Register a Trusted Publisher for that package on its registry (PyPI, and so on) pointing at this repo and its release workflow. Nothing at the repo root needs to change, and the Node release path is unaffected.

## Troubleshooting

- **Nothing published after merging.** The version in `node/package.json` was probably unchanged, or the push did not touch `node/**`.
- **Publish fails with a 404 or auth error.** The Trusted Publisher is missing or points at the wrong repo or workflow filename. It must be repo `auther-backend-sdk`, workflow `release.yml`.
