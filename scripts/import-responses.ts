// Run on the destination service with DATABASE_PATH pointing at its persistent disk.
import { readFile } from "node:fs/promises";
import { createApplication, getApplication, StoreError } from "../lib/store.ts";
import type { ApplicationInput } from "../lib/store.ts";
let rows: Record<string, unknown>[];
if (process.argv[2]) {
  const data = JSON.parse(await readFile(process.argv[2], "utf8"));
  rows = Array.isArray(data) ? data : data.rows;
} else {
  const source = process.env.SOURCE_RESPONSES_URL,
    key = process.env.SOURCE_RESPONSES_KEY;
  if (!source || !key)
    throw new Error(
      "Set SOURCE_RESPONSES_URL and SOURCE_RESPONSES_KEY, or pass a JSON file path.",
    );
  const url = new URL(source);
  if (url.protocol !== "https:") throw new Error("Source URL must use HTTPS.");
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${key}`,
      ...(process.env.SOURCE_SITES_TOKEN
        ? {
            "OAI-Sites-Authorization": `Bearer ${process.env.SOURCE_SITES_TOKEN}`,
          }
        : {}),
    },
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Source fetch failed: ${response.status}`);
  const data = (await response.json()) as { rows: Record<string, unknown>[] };
  rows = data.rows;
}
if (!Array.isArray(rows)) throw new Error("Expected a rows array.");
let imported = 0,
  skipped = 0;
for (const row of rows) {
  if (typeof row.id !== "string" || typeof row.createdAt !== "string")
    throw new Error("Import rows require an id and createdAt.");
  try {
    getApplication(row.id);
    skipped++;
    continue;
  } catch (e) {
    if (!(e instanceof StoreError && e.status === 404)) throw e;
  }
  for (const key of ["name", "phone", "room", "moveIn", "stayType"])
    if (typeof row[key] !== "string")
      throw new Error(`Invalid ${key} in source response.`);
  createApplication(
    {
      name: row.name,
      phone: row.phone,
      room: row.room,
      moveIn: row.moveIn,
      stayType: row.stayType,
      moveOut: row.moveOut || null,
      notes: row.notes || null,
    } as ApplicationInput,
    row.id,
    row.createdAt,
  );
  imported++;
}
console.log(JSON.stringify({ imported, skipped }));
