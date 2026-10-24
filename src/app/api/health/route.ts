import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * "Is the site able to reach its database?" — the target of the periodic ping that keeps a
 * suspend-when-idle database awake (.github/workflows/keep-database-awake.yml, vercel.json), and a
 * URL an uptime monitor can watch. Public on purpose: it reveals nothing but up/down.
 * The query goes through the retrying pool, so a database that is waking up is waited for.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

async function check() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, database: "up", ms: Date.now() - started }, { headers: NO_STORE });
  } catch (e) {
    console.error("[health] database check failed", e);
    return NextResponse.json({ ok: false, database: "unreachable", ms: Date.now() - started }, { status: 503, headers: NO_STORE });
  }
}

export const GET = check;
export const HEAD = check;
