import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/session";

/**
 * Just enough for the Header to render a real avatar client-side (src/components/layout/Header.tsx)
 * without personalizing the page itself — the storefront shell stays fully static/ISR-cached (see
 * src/lib/use-logged-in.ts's own doc comment on why that matters), and this is the one small,
 * per-visitor fetch that happens after mount instead, same convention as other client widgets that
 * need live/personalized data (perf/reduce-invocations' "Fix 5"). No DB call: name/avatarUrl are
 * already sitting in the signed session cookie from login time.
 */
export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json(null, { status: 401 });
  return NextResponse.json({ name: session.name, email: session.email, avatarUrl: session.avatarUrl });
}
