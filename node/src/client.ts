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
): Promise<VerifyResult> {
    return new Promise((resolve) => {
        const body   = JSON.stringify({ token });
        const url    = new URL('/api/v1/auth/verify', endpoint);
        const driver = url.protocol === 'http:' ? http : https;

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
                            resolve({ ok: true, user: json.data.user as AutherUser });
                        } else {
                            resolve({
                                ok:      false,
                                status:  res.statusCode ?? 500,
                                message: json?.message ?? 'Token verification failed',
                            });
                        }
                    } catch {
                        resolve({ ok: false, status: 500, message: 'Unexpected response from Auther backend' });
                    }
                });
            },
        );

        req.on('error', (err) => {
            resolve({ ok: false, status: 503, message: `Auther backend unreachable: ${err.message}` });
        });

        req.write(body);
        req.end();
    });
}
