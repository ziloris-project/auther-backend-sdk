import crypto from 'crypto';
import type { AutherUser } from './types';

/**
 * Offline token verification using the published JWKS.
 *
 * The default `verify()` calls the Auther API, which is authoritative: it sees
 * suspended users and revoked sessions the instant they happen. This does not.
 * It checks the signature and the claims, and nothing more.
 *
 * THE TRADE-OFF, stated plainly, because choosing wrongly here is a security
 * decision and not a performance one:
 *
 *   API verify   — a round trip per request; revocation is immediate.
 *   Local verify — no round trip, works if we are down; a revoked session stays
 *                  valid until its access token expires (at most 15 minutes).
 *
 * Use local verification for high-volume read paths where a 15-minute window is
 * acceptable. Keep API verification for anything where "this user was just
 * banned" has to take effect now.
 *
 * Implemented with node's crypto rather than a JWT library to keep this package
 * dependency-free, which matters more for a backend SDK than saving fifty lines.
 */

interface Jwk {
    kid: string;
    kty: string;
    n:   string;
    e:   string;
    alg?: string;
    use?: string;
}

interface CachedJwks {
    keys:    Map<string, crypto.KeyObject>;
    expires: number;
}

const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;   // an hour; rotation is rare and a miss just refetches
const jwksCache = new Map<string, CachedJwks>();

/** Fetch and cache the JWKS for an endpoint, keyed by its origin. */
async function loadJwks(endpoint: string, timeoutMs: number, force = false): Promise<Map<string, crypto.KeyObject>> {
    const origin = new URL(endpoint).origin;
    const cached = jwksCache.get(origin);
    if (!force && cached && cached.expires > Date.now()) return cached.keys;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(`${origin}/.well-known/jwks.json`, { signal: controller.signal });
        if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);

        const body = (await res.json()) as { keys: Jwk[] };
        const keys = new Map<string, crypto.KeyObject>();

        for (const jwk of body.keys ?? []) {
            // Only RSA signing keys. Anything else is not something we sign with.
            if (jwk.kty !== 'RSA' || (jwk.alg && jwk.alg !== 'RS256')) continue;
            try {
                keys.set(jwk.kid, crypto.createPublicKey({ key: jwk as any, format: 'jwk' }));
            } catch {
                // One malformed key must not poison the whole set.
            }
        }

        jwksCache.set(origin, { keys, expires: Date.now() + JWKS_CACHE_TTL_MS });
        return keys;
    } finally {
        clearTimeout(timer);
    }
}

function decodeSegment(segment: string): any {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

export interface LocalVerifyResult {
    ok:      boolean;
    user?:   Pick<AutherUser, 'id' | 'projectId'>;
    message?: string;
}

/**
 * Verify a token against the JWKS, without contacting the API.
 *
 * @param expectedProjectId  The project uuid this token must belong to. Required,
 *                           not optional: every Auther project's tokens are signed
 *                           by the same keys, so a signature check ALONE would
 *                           accept a valid token minted for someone else's project.
 */
export async function verifyLocally(
    token:             string,
    endpoint:          string,
    expectedProjectId: string,
    timeoutMs = 5000,
): Promise<LocalVerifyResult> {
    const parts = token.split('.');
    if (parts.length !== 3) return { ok: false, message: 'Malformed token' };

    let header: { alg?: string; kid?: string };
    let payload: { uid?: string; pid?: string; exp?: number };
    try {
        header  = decodeSegment(parts[0]);
        payload = decodeSegment(parts[1]);
    } catch {
        return { ok: false, message: 'Malformed token' };
    }

    // Pinned, never taken from the token. Accepting the token's own algorithm is
    // the JWT confusion attack: an attacker sets alg to HS256 and signs with the
    // public key, which is published by design.
    if (header.alg !== 'RS256') return { ok: false, message: 'Unsupported token algorithm' };
    if (!header.kid)            return { ok: false, message: 'Token has no key id' };

    let keys = await loadJwks(endpoint, timeoutMs);
    let key  = keys.get(header.kid);

    // An unknown kid usually means the key rotated since we cached. Refetch once
    // before rejecting, or every client would fail until its cache expired.
    if (!key) {
        keys = await loadJwks(endpoint, timeoutMs, true);
        key  = keys.get(header.kid);
    }
    if (!key) return { ok: false, message: 'Token was signed by an unknown key' };

    const signed   = `${parts[0]}.${parts[1]}`;
    const signature = Buffer.from(parts[2], 'base64url');
    if (!crypto.verify('RSA-SHA256', Buffer.from(signed), key, signature)) {
        return { ok: false, message: 'Invalid token signature' };
    }

    // A valid signature says the token is ours, not that it is still good.
    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
        return { ok: false, message: 'Token has expired' };
    }

    // The check that makes this multi-tenant-safe: all projects share signing
    // keys, so without it a token from any other project would pass.
    if (payload.pid !== expectedProjectId) {
        return { ok: false, message: 'Token does not belong to this project' };
    }

    if (!payload.uid) return { ok: false, message: 'Token is missing a subject' };

    return { ok: true, user: { id: payload.uid, projectId: payload.pid } };
}

/** Drop cached keys. Useful in tests and after a known rotation. */
export function clearJwksCache(): void {
    jwksCache.clear();
}
