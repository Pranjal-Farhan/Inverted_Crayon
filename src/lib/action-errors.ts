import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

/**
 * Every admin action in Finance, Inventory and Orders answers with { ok, error } and never lets an
 * exception escape — so the person using the screen always sees WHY something failed, in words,
 * next to the thing they clicked. Two kinds of failure end up here:
 *
 *  - an expected refusal the code raises on purpose (`UserError`, e.g. "not enough stock"): its
 *    message is already written for the admin and is shown as is;
 *  - anything unexpected (a database hiccup, a bug): turned into a plain explanation by describeError,
 *    and logged in full on the server so the cause can still be traced.
 */

export type Result = { ok: boolean; error: string };
export const OK: Result = { ok: true, error: "" };
export const fail = (error: string): Result => ({ ok: false, error });

/** A refusal with a message meant for the admin ("Not enough stock for …", "That owner no longer exists."). */
export class UserError extends Error {}

/** redirect() / notFound() work by throwing; those must keep propagating. */
function isFrameworkSignal(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"));
}

export function describeError(e: unknown): string {
  if (e instanceof UserError) return e.message;
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? "Check the form and try again.";
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case "P2002": {
        const t = e.meta?.target;
        return `That already exists${t ? ` (${Array.isArray(t) ? t.join(", ") : String(t)} must be unique)` : ""}. Pick a different value.`;
      }
      case "P2003":
        return "That is still in use by other records, so it can't be changed or deleted.";
      case "P2025":
        return "That record no longer exists — reload the page and try again.";
      case "P2034":
        return "Another change happened at the same moment, so this one was cancelled. Please try again.";
      case "P2028":
        return "The database took too long to finish this. Please try again.";
      case "P2010":
      case "P2004":
        return "The database refused this change: it would break a rule it enforces (for example a stock count below zero).";
    }
  }
  if (e instanceof Prisma.PrismaClientInitializationError) return "Couldn't reach the database. Wait a moment and try again.";
  if (e instanceof Prisma.PrismaClientValidationError) return "Some of the details sent were not in the right format. Reload the page and try again.";
  const message = e instanceof Error ? e.message : String(e);
  // The first line only — Prisma errors append the whole query after it.
  const first = message.split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "";
  return `Something went wrong: ${first.slice(0, 220) || "unknown error"}.`;
}

/**
 * Runs an action body and turns any failure into a { ok: false, error } the screen can show.
 * `label` names the action in the server log.
 */
export async function guarded<T extends Result>(label: string, run: () => Promise<T>): Promise<T | Result> {
  try {
    return await run();
  } catch (e) {
    if (isFrameworkSignal(e)) throw e;
    if (!(e instanceof UserError)) console.error(`[action:${label}]`, e);
    return fail(describeError(e));
  }
}
