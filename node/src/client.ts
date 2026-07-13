import https from 'https';
import http  from 'http';
import { AutherUser } from './types';

export type VerifyResult =
    | { ok: true;  user: AutherUser }
    | { ok: false; status: number; message: string };

/**
 * Calls POST /api/v1/auth/verify on the Auther backend.
 * Uses Node's built-in http/https — zero external runtime dependencies.
 */
export function callVerify(
    endpoint:     string,
    clientId:     string,
    clientSecret: string,
    token:        string,
    timeoutMs     = 5000,
): Promise<VerifyResult> {
    return new Promise((resolve) => {
        const body   = JSON.stringify({ token });
        const url    = new URL('/api/v1/auth/verify', endpoint);
        const driver = url.protocol === 'http:' ? http : https;
        let settled  = false;
        const finish = (r: VerifyResult) => { if (!settled) { settled = true; resolve(r); } };

        const req = driver.request(
            {
                hostname: url.hostname,
                port:     url.port || (url.protocol === 'http:' ? 80 : 443),
                path:     url.pathname,
                method:   'POST',
                headers:  {
                    'content-type':    'application/json',
                    'content-length':  Buffer.byteLength(body),
                    'x-client-id':     clientId,
                    'x-client-secret': clientSecret,
                },
            },
            (res) => {
                let raw = '';
                res.on('data', (chunk) => { raw += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(raw);
                        if (res.statusCode === 200 && json?.data?.user) {
                            finish({ ok: true, user: json.data.user as AutherUser });
                        } else {
                            finish({
                                ok:      false,
                                status:  res.statusCode ?? 500,
                                message: json?.message ?? 'Token verification failed',
                            });
                        }
                    } catch {
                        finish({ ok: false, status: 500, message: 'Unexpected response from Auther backend' });
                    }
                });
            },
        );

        // Fail fast instead of hanging the caller's request if the backend
        // stalls. destroy() fires the 'error' handler below with ECONNRESET,
        // but `settled` makes the timeout result win.
        req.setTimeout(timeoutMs, () => {
            finish({ ok: false, status: 504, message: `Auther backend timed out after ${timeoutMs}ms` });
            req.destroy();
        });

        req.on('error', (err) => {
            finish({ ok: false, status: 503, message: `Auther backend unreachable: ${err.message}` });
        });

        req.write(body);
        req.end();
    });
}
