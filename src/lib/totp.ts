import "server-only";
import { createHmac, randomBytes } from "node:crypto";

/**
 * TOTP (RFC 6238) — the algorithm behind Google Authenticator, Authy, 1Password, etc. Hand-rolled
 * against the RFC rather than pulled in as a dependency: it's ~60 lines of well-specified HMAC-SHA1
 * + base32, and keeping it in-repo means the admin's 2FA secret never passes through code we didn't
 * write ourselves.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** A fresh random secret for a new 2FA setup — 20 bytes (160 bits), the RFC-recommended size. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", key).update(counterBuf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function currentTotpCode(secret: string, at: number = Date.now()): string {
  return hotp(secret, Math.floor(at / 1000 / STEP_SECONDS));
}

/** Accepts the current 30s step plus one step either side, to tolerate normal clock drift. */
export function verifyTotpCode(secret: string, code: string, at: number = Date.now()): boolean {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) return false;
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  for (const delta of [0, -1, 1]) {
    if (hotp(secret, counter + delta) === trimmed) return true;
  }
  return false;
}

export function totpAuthUri(secret: string, accountEmail: string, issuer = "Inverted Crayon"): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Random, human-typeable one-time backup codes (e.g. "7K3F-9QXZ") for when the device is lost. */
export function generateBackupCodes(count = 8): string[] {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids transcription errors
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(8);
    let code = "";
    for (let i = 0; i < 8; i++) code += alphabet[bytes[i] % alphabet.length];
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  });
}
