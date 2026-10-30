/**
 * Session cookie constants. Deliberately dependency-free (no Node `crypto` import) so this file
 * is safe to import from `middleware.ts` no matter which runtime Next.js picks for it: it's a
 * plain string comparison there, not a cryptographic operation. The token is derived from the
 * password's stored hash (see lib/auth.ts), not the password itself.
 */
export const SESSION_COOKIE_NAME = "gtj_session";
export const SESSION_TOKEN = "49d2d45413262f96dea94cd0143813ace2d19fe7cb94e4382411fd071042a71e";
