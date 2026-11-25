import { listApplications, statuses, type Status } from "../../../lib/store";
import { authorize, fail, HttpError, json } from "../../../lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    authorize(request);
    const p = new URL(request.url).searchParams;
    const status = p.get("status") || undefined,
      room = p.get("room") || undefined,
      q = p.get("q") || undefined;
    if (status && !statuses.includes(status as Status))
      throw new HttpError("Invalid status.");
    if (room && !["A", "B", "both"].includes(room))
      throw new HttpError("Invalid room.");
    if (q && q.length > 200) throw new HttpError("Search is too long.");
    const limit = Number(p.get("limit") || 50),
      offset = Number(p.get("offset") || 0);
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    )
      throw new HttpError(
        "limit must be 1–100 and offset must be nonnegative.",
      );
    return json(
      listApplications({
        status: status as Status,
        room: room as "A" | "B" | "both",
        q,
        limit,
        offset,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
