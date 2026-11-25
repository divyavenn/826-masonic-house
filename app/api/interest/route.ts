import { createApplication } from "../../../lib/store";
import { body, date, fail, HttpError, json, text } from "../../../lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const canonical =
      process.env.PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL;
    const host = request.headers.get("host") || new URL(request.url).host;
    const protocol =
      request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
      new URL(request.url).protocol.slice(0, -1);
    const expected = canonical
      ? new URL(canonical).origin
      : `${protocol}://${host}`;
    if (request.headers.get("origin") !== expected)
      throw new HttpError("Please submit from this website.", 403);
    const p = await body(request);
    if (p.website) return json({ ok: true });
    const name = text(p.name, "Name"),
      phone = text(p.phone, "Phone");
    if (phone.replace(/\D/g, "").length < 7)
      throw new HttpError("Enter a valid phone number.");
    if (!["A", "B", "both"].includes(p.room as string))
      throw new HttpError("Select Room A, Room B, or both.");
    if (!["roommate", "sublet"].includes(p.stayType as string))
      throw new HttpError("Select roommate or sublet.");
    const moveIn = date(p.moveIn, "Move-in");
    const moveOut =
      p.stayType === "sublet" ? date(p.moveOut, "Move-out") : null;
    if (moveOut && moveOut <= moveIn)
      throw new HttpError("Move-out must be after move-in.");
    createApplication({
      name,
      phone,
      room: p.room as "A" | "B" | "both",
      stayType: p.stayType as "roommate" | "sublet",
      moveIn,
      moveOut,
      notes: text(p.notes, "Notes", 2000, true) || null,
    });
    return json({ ok: true }, 201);
  } catch (error) {
    return fail(error);
  }
}
