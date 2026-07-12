# Auther Backend SDKs

Server-side SDKs for [Auther](https://auther.ziloris.com): verify end-user tokens in
your backend, in whatever language it is written in. Built by Ziloris.

This repository is **polyglot**. Each language/framework SDK lives in its own top-level
directory with its own toolchain, build, and release. There is deliberately **no shared
package manager at the root**, because a Node package and a future Python package do not
share a lockfile.

## SDKs

| Language | Directory | Package | Status |
|---|---|---|---|
| Node.js / Express | [`node/`](./node) | [`@auther-sdk/node`](https://www.npmjs.com/package/@auther-sdk/node) | Available |
| Python | `python/` | `auther-sdk` (PyPI) | Planned |
| Go | `go/` | `github.com/ziloris-project/auther-backend-sdk/go` | Planned |

## Node quick start

```bash
npm install @auther-sdk/node
```

```ts
import { Auther } from '@auther-sdk/node';
import express from 'express';

const app = express();
const auther = new Auther({ clientId: 'req_live_...', clientSecret: 'sk_live_...' });

app.get('/me', auther.protect(), (req, res) => {
    res.json({ user: req.autherUser });
});
```

Full guide at [auther.ziloris.com/docs](https://auther.ziloris.com/docs).

## Repository layout

Each SDK is self-contained. Adding a new language means adding a directory and a matching
CI/release job. Nothing at the root needs to know about the others.

```
auther-backend-sdk/
├── node/                  # @auther-sdk/node, tsup build, npm publish
├── python/    (planned)   # its own pyproject.toml, build, PyPI publish
├── go/        (planned)   # its own go.mod
└── .github/workflows/     # one CI + release job per language
```

## Releasing

Releases are published from CI, never from a developer machine. See
[RELEASING.md](./RELEASING.md) for details. In short, for Node: bump the `version` in
[`node/package.json`](./node/package.json) in your PR, and merging to `main` publishes it
with [sigstore provenance](https://docs.npmjs.com/generating-provenance-statements) if
that version is not already on npm.

## License

[Apache-2.0](./LICENSE), Copyright Ziloris.
