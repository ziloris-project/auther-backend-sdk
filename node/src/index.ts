import type { RequestHandler } from 'express';
import { AutherConfig, AutherUser } from './types';
import { createProtect } from './middleware';
import { callVerify, VerifyResult } from './client';

export type { AutherConfig, AutherUser, VerifyResult };

/**
 * Auther Node.js SDK
 *
 * Install:  npm install @auther-sdk/node
 *
 * @example
 * import { Auther } from 'auther-node';
 * import express from 'express';
 * import cookieParser from 'cookie-parser';
 *
 * const app    = express();
 * const auther = new Auther({
 *   clientId:     'req_live_...',
 *   clientSecret: 'sk_live_...',
 *   // endpoint auto-resolves: localhost:4000 in development, production otherwise
 * });
 *
 * app.use(cookieParser());
 *
 * // Protect a route — req.autherUser is populated on success
 * app.get('/me', auther.protect(), (req, res) => {
 *   res.json({ user: req.autherUser });
 * });
 *
 * // Or verify a token manually
 * const result = await auther.verify(token);
 * if (result.ok) console.log(result.user);
 */
export class Auther {
    private readonly config: Required<AutherConfig>;

    constructor(config: AutherConfig) {
        if (!config.clientId)     throw new Error('[auther-node] clientId is required');
        if (!config.clientSecret) throw new Error('[auther-node] clientSecret is required');

        const isDev = process.env.DEV_ENV === 'development';
        this.config = {
            clientId:     config.clientId,
            clientSecret: config.clientSecret,
            endpoint:     config.endpoint ?? (isDev ? 'http://localhost:4000' : 'https://oautherbackend.ziloris.com'),
        };
    }

    /**
     * Express middleware — protects a route.
     * Reads the token from Authorization header or auther_access cookie.
     * Populates req.autherUser on success.
     *
     * Requires cookie-parser if using cookie-based auth:
     *   app.use(require('cookie-parser')())
     */
    protect(): RequestHandler {
        return createProtect(this.config);
    }

    /**
     * Manually verify a raw token string.
     * Useful for WebSocket auth, custom pipelines, or non-Express frameworks.
     */
    async verify(token: string): Promise<VerifyResult> {
        return callVerify(
            this.config.endpoint,
            this.config.clientId,
            this.config.clientSecret,
            token,
        );
    }
}
