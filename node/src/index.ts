import type { RequestHandler } from 'express';
import { AutherConfig, AutherUser } from './types';
import { createProtect } from './middleware';
import { callVerify, VerifyResult } from './client';
import { verifyLocally, clearJwksCache } from './localVerify';

export type { AutherConfig, AutherUser, VerifyResult };

/**
 * Auther Node.js SDK
 *
 * Install:  npm install @auther-sdk/node
 *
 * @example
 * import { Auther } from '@auther-sdk/node';
 * import express from 'express';
 * import cookieParser from 'cookie-parser';
 *
 * const app    = express();
 * const auther = new Auther({
 *   clientId:     'req_live_...',
 *   clientSecret: 'sk_live_...',
 *   // endpoint defaults to the Auther production API; set it to point at a
 *   // local backend during development
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

    /**
     * This project's uuid, learned from the first successful API verification.
     *
     * Local verification needs it: every project's tokens are signed by the
     * same keys, so a signature check alone would accept a token minted for
     * somebody else's project. Rather than making callers configure a value
     * they would have to look up, the first API verify tells us authoritatively
     * and we keep it — a project's uuid never changes for a given client id.
     */
    private projectId: string | null = null;

    constructor(config: AutherConfig) {
        if (!config.clientId)     throw new Error('[auther-node] clientId is required');
        if (!config.clientSecret) throw new Error('[auther-node] clientSecret is required');

        this.config = {
            clientId:     config.clientId,
            clientSecret: config.clientSecret,
            // Always the production API unless the caller overrides it. We do
            // not auto-switch on NODE_ENV, since a consumer's dev build must
            // not silently point at a localhost Auther that is not theirs.
            endpoint:     config.endpoint ?? 'https://oautherbackend.ziloris.com',
            timeoutMs:    config.timeoutMs ?? 5000,
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
        const result = await callVerify(
            this.config.endpoint,
            this.config.clientId,
            this.config.clientSecret,
            token,
            this.config.timeoutMs,
        );
        // Remember which project we are, so verifyLocal() can bind tokens to it.
        if (result.ok && result.user?.projectId) this.projectId = result.user.projectId;
        return result;
    }

    /**
     * Verify a token WITHOUT calling Auther, using the published public keys.
     *
     * Faster, and keeps working if Auther is unreachable. The cost is
     * freshness: this checks the signature and claims only, so a session
     * revoked seconds ago still passes until the access token expires — at most
     * 15 minutes. `verify()` sees revocation immediately.
     *
     * Use this on high-volume read paths where a 15-minute window is
     * acceptable. Use `verify()` where "this user was just banned" has to take
     * effect now.
     *
     * The first call falls back to an API verification to learn this project's
     * id, which local checks are bound to; after that it is fully offline.
     */
    async verifyLocal(token: string): Promise<VerifyResult> {
        if (!this.projectId) {
            // One authoritative call to learn who we are. Also validates this
            // token, so nothing is skipped.
            return this.verify(token);
        }

        const result = await verifyLocally(
            token,
            this.config.endpoint,
            this.projectId,
            this.config.timeoutMs,
        );

        if (!result.ok) return { ok: false, status: 401, message: result.message ?? 'Invalid token' };

        // Local verification proves the token, not the current state of the
        // account, so only what the token itself asserts is returned. Anything
        // more would be stale data presented as fresh.
        return {
            ok: true,
            user: {
                id:            result.user!.id,
                projectId:     result.user!.projectId,
                email:         '',
                name:          null,
                emailVerified: false,
                createdAt:     '',
            },
        };
    }

    /** Drop cached signing keys. Rarely needed; useful in tests. */
    clearKeyCache(): void {
        clearJwksCache();
    }
}
