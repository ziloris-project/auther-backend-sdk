// ── Public types ──────────────────────────────────────────────────────────────

export interface AutherConfig {
    /** Your project's Client ID — found in Auther dashboard → API Keys. */
    clientId: string;
    /** Your project's Client Secret — found in Auther dashboard → API Keys. */
    clientSecret: string;
    /**
     * Override the Auther backend URL. Defaults to the Auther production API.
     * Set this to point at a local or self-hosted backend, for example
     * 'http://localhost:4000' during development.
     */
    endpoint?: string;
    /**
     * Max milliseconds to wait for a token verification request before giving
     * up. Prevents a slow or hung Auther backend from stalling your request.
     * Defaults to 5000 (5s). On timeout, verification fails with status 504.
     */
    timeoutMs?: number;
}

export interface AutherUser {
    /** End-user UUID */
    id:            string;
    email:         string;
    /** Display name, from signup or the OAuth provider. Null when never given. */
    name:          string | null;
    emailVerified: boolean;
    createdAt:     string;
    /** Auther project UUID this user belongs to */
    projectId:     string;
}

// ── Express augmentation ──────────────────────────────────────────────────────

declare global {
    namespace Express {
        interface Request {
            /** Populated by auther.protect() when token verification succeeds. */
            autherUser?: AutherUser;
        }
    }
}
