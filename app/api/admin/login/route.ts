import { body, fail, HttpError, json, text } from "../../../../lib/http";
import {
  password,
  matchesPassword,
  sameOrigin,
  createSession,
  cookieName,
  sessionSeconds,
} from "../../../../lib/auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (!password())
      throw new HttpError("Set ADMIN_PASSWORD before signing in.", 503);
    if (!sameOrigin(request))
      throw new HttpError("Sign in from this website.", 403);
    const p = await body(request);
    if (!matchesPassword(text(p.password, "Password", 1000)))
      throw new HttpError("Incorrect password.", 401);
    const response = json({ ok: true });
    const secure =
      request.headers.get("x-forwarded-proto") === "https" ||
      new URL(request.url).protocol === "https:";
    response.headers.set(
      "Set-Cookie",
      `${cookieName}=${createSession()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionSeconds}${secure ? "; Secure" : ""}`,
    );
    return response;
  } catch (error) {
    return fail(error);
  }
}
