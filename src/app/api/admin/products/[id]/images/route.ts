import { NextResponse } from "next/server";
import { getAdminForArea } from "@/lib/admin-guard";
import { addProductImage } from "@/lib/product-images";

// A plain upload endpoint rather than a Server Action: actions are queued one behind another by the
// browser and re-render the whole page after each call, which is exactly what made a second photo
// stall. This takes one photo per request and answers with a few bytes of JSON.
// Sized to cover ImgBB's retries (see src/lib/imgbb.ts) with room to spare.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: Params) {
  // The session cookie is SameSite=Lax, which already keeps another site from posting here with
  // it; this refuses a mismatched Origin outright as well.
  const origin = request.headers.get("origin");
  if (origin) {
    let sameHost = false;
    try {
      sameHost = new URL(origin).host === new URL(request.url).host;
    } catch {}
    if (!sameHost) return json({ ok: false, error: "Cross-site upload refused." }, 403);
  }

  const admin = await getAdminForArea("products");
  if (!admin) return json({ ok: false, error: "You're signed out or not allowed to edit products — reload and sign in again." }, 401);

  const { id } = await params;
  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return json({ ok: false, error: "The upload arrived incomplete — try again." }, 400);
  }
  if (!(file instanceof File) || file.size === 0) return json({ ok: false, error: "No photo received." }, 400);

  const result = await addProductImage(id, file);
  if (!result.ok) return json({ ok: false, error: result.error, ms: result.ms }, result.status);
  return json({ ok: true, image: result.image, ms: result.ms });
}
