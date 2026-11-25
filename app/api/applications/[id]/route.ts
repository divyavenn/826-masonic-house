import {
  getApplication,
  activity,
  updateApplication,
  statuses,
  type Status,
} from "../../../../lib/store";
import {
  authorize,
  body,
  fail,
  HttpError,
  json,
  text,
} from "../../../../lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    authorize(request);
    const { id } = await context.params;
    return json({ application: getApplication(id), activity: activity(id) });
  } catch (error) {
    return fail(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const actor = authorize(request, true);
    const { id } = await context.params;
    const p = await body(request);
    if (
      Object.keys(p).some(
        (key) =>
          !["expectedVersion", "status", "note", "metadata"].includes(key),
      )
    )
      throw new HttpError("Unknown update field.");
    if (
      p.expectedVersion !== undefined &&
      (!Number.isSafeInteger(p.expectedVersion) ||
        Number(p.expectedVersion) < 1)
    )
      throw new HttpError("expectedVersion must be a positive integer.");
    if (p.status !== undefined && !statuses.includes(p.status as Status))
      throw new HttpError("Invalid status.");
    if (
      p.metadata !== undefined &&
      (!p.metadata ||
        typeof p.metadata !== "object" ||
        Array.isArray(p.metadata) ||
        JSON.stringify(p.metadata).length > 8000)
    )
      throw new HttpError("metadata must be an object up to 8,000 characters.");
    const note = p.note === undefined ? undefined : text(p.note, "Note", 4000);
    if (p.status === undefined && p.metadata === undefined && !note)
      throw new HttpError("Provide a status, metadata, or note.");
    const application = updateApplication(
      id,
      {
        expectedVersion:
          p.expectedVersion === undefined
            ? undefined
            : Number(p.expectedVersion),
        status: p.status as Status | undefined,
        note,
        metadata: p.metadata as Record<string, unknown> | undefined,
      },
      actor,
    );
    return json({ application, activity: activity(id) });
  } catch (error) {
    return fail(error);
  }
}
