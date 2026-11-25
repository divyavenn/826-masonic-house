import { health } from "../../../lib/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() {
  try {
    health();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
