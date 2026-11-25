import { statuses, type Status } from "./store.ts";
import { HttpError } from "./http.ts";
export function filters(request: Request) {
  const p = new URL(request.url).searchParams;
  const status = p.get("status") || undefined,
    room = p.get("room") || undefined,
    q = p.get("q") || undefined;
  if (status && !statuses.includes(status as Status))
    throw new HttpError("Invalid status.");
  if (room && !["A", "B", "both"].includes(room))
    throw new HttpError("Invalid room.");
  if (q && q.length > 200) throw new HttpError("Search is too long.");
  return {
    status: status as Status | undefined,
    room: room as "A" | "B" | "both" | undefined,
    q,
  };
}
