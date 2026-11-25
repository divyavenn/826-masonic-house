import { password, matchesPassword, hasSession, sameOrigin } from "./auth.ts";
import { StoreError } from "./store.ts";
export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function fail(error: unknown) {
  if (error instanceof HttpError || error instanceof StoreError)
    return json({ error: error.message }, error.status);
  console.error(
    "Application operation failed:",
    error instanceof Error ? error.name : "unknown error",
  );
  return json(
    { error: "Unable to complete the request. Please try again." },
    503,
  );
}
export function authorize(request: Request, _write = false) {
  if (!password())
    throw new HttpError("Set ADMIN_PASSWORD to enable admin access.", 503);
  const bearer =
    request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1] || "";
  if (matchesPassword(bearer))
    return (request.headers.get("x-agent-name") || "program").slice(0, 80);
  if (!hasSession(request))
    throw new HttpError("Enter the shared password.", 401);
  if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request))
    throw new HttpError("Submit from this website.", 403);
  return "admin";
}
export async function body(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError("Use Content-Type: application/json.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError("A JSON body is required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) {
      await reader.cancel();
      throw new HttpError("Request too large.", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError("Invalid JSON.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new HttpError("A JSON object is required.");
  return data as Record<string, unknown>;
}
export function text(
  value: unknown,
  label: string,
  max = 200,
  optional = false,
) {
  if (optional && (value === undefined || value === null)) return "";
  if (typeof value !== "string") throw new HttpError(`${label} must be text.`);
  const result = value.trim();
  if ((!optional && !result) || result.length > max)
    throw new HttpError(
      `${label} is ${optional ? "optional and must be" : "required and must be"} ${max} characters or fewer.`,
    );
  return result;
}
export function date(value: unknown, label: string) {
  const s = text(value, label, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    throw new HttpError(`${label} must be a valid YYYY-MM-DD date.`);
  return s;
}
