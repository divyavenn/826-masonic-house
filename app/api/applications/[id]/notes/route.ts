import { addNote, activity } from "../../../../../lib/store";
import {
  authorize,
  body,
  fail,
  HttpError,
  json,
  text,
} from "../../../../../lib/http";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = authorize(request, true);
    const { id } = await context.params;
    const p = await body(request);
    if (Object.keys(p).some((k) => k !== "text"))
      throw new HttpError("Only text is accepted.");
    const application = addNote(id, text(p.text, "Note", 4000), actor);
    return json({ application, activity: activity(id) }, 201);
  } catch (error) {
    return fail(error);
  }
}
