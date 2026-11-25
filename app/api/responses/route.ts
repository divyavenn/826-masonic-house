import { listApplications } from "../../../lib/store";
import { authorize, fail, json } from "../../../lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    authorize(request);
    return json({
      rows: listApplications({ limit: 100, offset: 0 }).applications,
    });
  } catch (error) {
    return fail(error);
  }
}
