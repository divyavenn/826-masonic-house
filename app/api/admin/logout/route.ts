import { sameOrigin, cookieName } from "../../../../lib/auth";
import { json } from "../../../../lib/http";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json({ error: "Submit from this website." }, 403);
  const response = json({ ok: true });
  response.headers.set(
    "Set-Cookie",
    `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
  return response;
}
