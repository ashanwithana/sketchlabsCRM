// In-memory login throttle. Adequate for a single-process deployment.
// Replace with a shared store (e.g. Redis or the database) if you scale out.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Entry = { count: number; resetAt: number };
const attempts = new Map<string, Entry>();

export function checkLoginAllowed(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) return { allowed: true, retryAfterSeconds: 0 };
  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedLogin(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearLoginAttempts(key: string) {
  attempts.delete(key);
}
