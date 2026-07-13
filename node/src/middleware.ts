import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { callVerify } from './client';
import { AutherConfig } from './types';

/**
 * Builds the Express protect() middleware.
 *
 * Token extraction order:
 *   1. Authorization: Bearer <token>   (standard REST header)
 *   2. auther_access cookie            (set automatically by the Auther frontend SDK)
 *
 * On success  → attaches req.autherUser and calls next()
 * On failure  → responds 401 / 403 JSON, does NOT call next()
 */
export function createProtect(config: Required<AutherConfig>): RequestHandler {
    const endpoint = config.endpoint;

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // ── 1. Extract token ───────────────────────────────────────────────────
        let token: string | undefined;

        const authHeader = req.headers['authorization'];
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.slice(7);
        } else if (req.cookies?.auther_access) {
            token = req.cookies.auther_access as string;
        }

        if (!token) {
            res.status(401).json({ success: false, message: 'No authentication token provided' });
            return;
        }

        // ── 2. Verify with Auther backend ──────────────────────────────────────
        const result = await callVerify(endpoint, config.clientId, config.clientSecret, token, config.timeoutMs);

        if (!result.ok) {
            res.status(result.status).json({ success: false, message: result.message });
            return;
        }

        // ── 3. Attach user and continue ────────────────────────────────────────
        req.autherUser = result.user;
        next();
    };
}
