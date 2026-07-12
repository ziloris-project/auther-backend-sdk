// ── Public types ──────────────────────────────────────────────────────────────

export interface AutherConfig {
    /** Your project's Client ID — found in Auther dashboard → API Keys. */
    clientId: string;
    /** Your project's Client Secret — found in Auther dashboard → API Keys. */
    clientSecret: string;
    /**
     * Override the Auther backend URL.
     * Auto-detected: localhost:4000 when NODE_ENV=development, production otherwise.
     * Only set this if you have a custom deployment.
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
