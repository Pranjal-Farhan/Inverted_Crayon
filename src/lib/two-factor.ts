import "server-only";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { matchTotpStep } from "@/lib/totp";

type FactorUser = { id: string; twoFactorSecret: string | null; twoFactorBackupCodes: string[] };

/** "7k3f9qxz", "7K3F 9QXZ" and "7K3F-9QXZ" are all the same backup code; anything else isn't one. */
function normalizeBackupCode(raw: string): string | null {
  const compact = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z2-9]{8}$/.test(compact) ? `${compact.slice(0, 4)}-${compact.slice(4)}` : null;
}

/**
 * Checks the second factor an account's owner just typed: a live authenticator code, or one unused
 * backup code. Returns which one matched, or null. Both are single-use, and the "use" is an atomic
 * database claim, so two requests racing with the same code can't both win:
 *  - an authenticator code is only good for a 30-second step later than the last one accepted
 *    (`twoFactorLastStep`) — a code that was already used, or watched over a shoulder, can't be
 *    replayed inside its validity window;
 *  - a backup code is removed from the stored list in the same write that accepts it.
 * Wrong-code lockout is the caller's job (it differs between login and Settings).
 */
export async function consumeSecondFactor(user: FactorUser, rawCode: string): Promise<"totp" | "backup" | null> {
  if (user.twoFactorSecret) {
    const step = matchTotpStep(user.twoFactorSecret, rawCode);
    if (step !== null) {
      const claimed = await db.adminUser.updateMany({
        where: { id: user.id, OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: step } }] },
        data: { twoFactorLastStep: step },
      });
      return claimed.count === 1 ? "totp" : null;
    }
  }

  const backup = normalizeBackupCode(rawCode);
  if (!backup) return null; // not even shaped like a backup code — skip the slow hash comparisons
  for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
    if (await bcrypt.compare(backup, user.twoFactorBackupCodes[i])) {
      const claimed = await db.adminUser.updateMany({
        // Only if the list is still exactly what we read — someone else using it meanwhile loses.
        where: { id: user.id, twoFactorBackupCodes: { equals: user.twoFactorBackupCodes } },
        data: { twoFactorBackupCodes: user.twoFactorBackupCodes.filter((_, j) => j !== i) },
      });
      return claimed.count === 1 ? "backup" : null;
    }
  }
  return null;
}
