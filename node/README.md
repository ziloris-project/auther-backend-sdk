# @auther-sdk/node

[![npm](https://img.shields.io/npm/v/@auther-sdk/node?style=flat&color=blue)](https://www.npmjs.com/package/@auther-sdk/node)

Official Node.js middleware for [Auther](https://auther.ziloris.com) — verify end-user
tokens in any Express/Node app with a single `auther.protect()` guard.

## Install

```bash
npm install @auther-sdk/node
```

## Usage

```ts
import { Auther } from '@auther-sdk/node';
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();
const auther = new Auther({
    clientId:     'req_live_...',
    clientSecret: 'sk_live_...',
});

app.use(cookieParser());

// Protect a route — req.autherUser is populated on success
app.get('/me', auther.protect(), (req, res) => {
    res.json({ user: req.autherUser });
});
```

Full guide at [auther.ziloris.com/docs](https://auther.ziloris.com/docs).

## License

[Apache-2.0](./LICENSE) © Ziloris
