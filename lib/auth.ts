import { createHash, createHmac, timingSafeEqual } from "node:crypto";
export const cookieName = "house_admin";
export const sessionSeconds = 8 * 60 * 60;
export function password() {
  return process.env.ADMIN_PASSWORD || "";
}
export function matchesPassword(value: string) {
  const expected = password();
  if (!expected) return false;
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(value), hash(expected));
}
function signature(expires: string) {
  return createHmac("sha256", password()).update(expires).digest("base64url");
}
export function createSession() {
  const expires = String(Date.now() + sessionSeconds * 1000);
  return `${expires}.${signature(expires)}`;
}
export function hasSession(request: Request) {
  if (!password()) return false;
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  if (!cookie) return false;
  const [expires, signed] = cookie.split(".");
  if (
    !expires ||
    !signed ||
    Number(expires) < Date.now() ||
    !/^\d+$/.test(expires)
  )
    return false;
  const expected = signature(expires);
  return (
    signed.length === expected.length &&
    timingSafeEqual(Buffer.from(signed), Buffer.from(expected))
  );
}
export function sameOrigin(request: Request) {
  const canonical =
    process.env.PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL;
  const host = request.headers.get("host") || new URL(request.url).host;
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    new URL(request.url).protocol.slice(0, -1);
  return (
    request.headers.get("origin") ===
    (canonical ? new URL(canonical).origin : `${protocol}://${host}`)
  );
}
