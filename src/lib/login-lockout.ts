import "server-only";

/**
 * Shared brute-force guard for admin/customer login — there's no rate limiting anywhere else in
 * front of these forms, so without this an attacker gets unlimited password guesses.
 */
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export function isLocked(lockedUntil: Date | null): boolean {
  return Boolean(lockedUntil && lockedUntil.getTime() > Date.now());
}

export function lockoutMessage(lockedUntil: Date): string {
  const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60000));
  return `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/** Computes the next failedLoginCount/lockedUntil pair after a failed attempt. */
export function nextLockoutState(currentFailedCount: number): { failedLoginCount: number; lockedUntil: Date | null } {
  const failedLoginCount = currentFailedCount + 1;
  const lockedUntil = failedLoginCount >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null;
  return { failedLoginCount, lockedUntil };
}
