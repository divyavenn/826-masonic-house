import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
export const statuses = [
  "new",
  "contacted",
  "viewing_scheduled",
  "viewed",
  "offered",
  "accepted",
  "declined",
  "no_longer_interested",
] as const;
export type Status = (typeof statuses)[number];
export type ApplicationInput = {
  name: string;
  phone: string;
  room: "A" | "B" | "both";
  moveIn: string;
  stayType: "roommate" | "sublet";
  moveOut: string | null;
  notes: string | null;
};
export type Application = ApplicationInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: Status;
  version: number;
  metadata: Record<string, unknown>;
  latestInternalNote: string | null;
  internalNotes: string | null;
};
export type Activity = {
  id: string;
  applicationId: string;
  createdAt: string;
  actor: string;
  type: string;
  note: string | null;
  fromStatus: Status | null;
  toStatus: Status | null;
};
export class StoreError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
let database: DatabaseSync | undefined;
function db() {
  if (database) return database;
  const filename =
    process.env.DATABASE_PATH || resolve("data/applications.sqlite");
  mkdirSync(dirname(filename), { recursive: true });
  const connection = new DatabaseSync(filename);
  connection.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
  connection.exec(`BEGIN IMMEDIATE;
 CREATE TABLE IF NOT EXISTS applications(id TEXT PRIMARY KEY,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,room TEXT NOT NULL,move_in TEXT NOT NULL,stay_type TEXT NOT NULL,move_out TEXT,notes TEXT,status TEXT NOT NULL DEFAULT 'new',version INTEGER NOT NULL DEFAULT 1,metadata TEXT NOT NULL DEFAULT '{}');
 CREATE INDEX IF NOT EXISTS applications_status_created ON applications(status,created_at DESC,id DESC);
 CREATE TABLE IF NOT EXISTS activity(id TEXT PRIMARY KEY,application_id TEXT NOT NULL REFERENCES applications(id),created_at TEXT NOT NULL,actor TEXT NOT NULL,type TEXT NOT NULL,note TEXT,from_status TEXT,to_status TEXT);
 CREATE INDEX IF NOT EXISTS activity_application ON activity(application_id,created_at,id);
 PRAGMA user_version=1;COMMIT;`);
  database = connection;
  return connection;
}
const fields =
  "id,created_at AS createdAt,updated_at AS updatedAt,name,phone,room,move_in AS moveIn,stay_type AS stayType,move_out AS moveOut,notes,status,version,metadata,(SELECT note FROM activity WHERE application_id=applications.id AND note IS NOT NULL ORDER BY rowid DESC LIMIT 1) AS latestInternalNote,(SELECT group_concat(note, char(10)||char(10)) FROM (SELECT note FROM activity WHERE application_id=applications.id AND note IS NOT NULL ORDER BY rowid)) AS internalNotes";
function map(row: Record<string, unknown>): Application {
  return {
    ...row,
    metadata: JSON.parse(row.metadata as string),
  } as Application;
}
function transaction<T>(run: () => T): T {
  const connection = db();
  connection.exec("BEGIN IMMEDIATE");
  try {
    const result = run();
    connection.exec("COMMIT");
    return result;
  } catch (e) {
    connection.exec("ROLLBACK");
    throw e;
  }
}
function event(
  applicationId: string,
  actor: string,
  type: string,
  note: string | null,
  fromStatus: Status | null,
  toStatus: Status | null,
) {
  db()
    .prepare("INSERT INTO activity VALUES(?,?,?,?,?,?,?,?)")
    .run(
      randomUUID(),
      applicationId,
      new Date().toISOString(),
      actor,
      type,
      note,
      fromStatus,
      toStatus,
    );
}
export function getApplication(id: string) {
  const row = db()
    .prepare(`SELECT ${fields} FROM applications WHERE id=?`)
    .get(id);
  if (!row) throw new StoreError("Application not found.", 404);
  return map(row);
}
export function activity(id: string) {
  getApplication(id);
  return db()
    .prepare(
      "SELECT id,application_id AS applicationId,created_at AS createdAt,actor,type,note,from_status AS fromStatus,to_status AS toStatus FROM activity WHERE application_id=? ORDER BY rowid",
    )
    .all(id) as Activity[];
}
export function createApplication(
  input: ApplicationInput,
  id: string = randomUUID(),
  createdAt: string = new Date().toISOString(),
) {
  return transaction(() => {
    db()
      .prepare(
        "INSERT INTO applications(id,created_at,updated_at,name,phone,room,move_in,stay_type,move_out,notes) VALUES(?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        id,
        createdAt,
        createdAt,
        input.name,
        input.phone,
        input.room,
        input.moveIn,
        input.stayType,
        input.moveOut,
        input.notes,
      );
    event(id, "applicant", "submitted", null, null, "new");
    return getApplication(id);
  });
}
export function listApplications(filters: {
  status?: Status;
  room?: "A" | "B" | "both";
  q?: string;
  limit: number;
  offset: number;
}) {
  const conditions: string[] = [];
  const parameters: (string | number)[] = [];
  if (filters.status) {
    conditions.push("status=?");
    parameters.push(filters.status);
  }
  if (filters.room) {
    conditions.push(
      filters.room === "both" ? "room='both'" : "(room=? OR room='both')",
    );
    if (filters.room !== "both") parameters.push(filters.room);
  }
  if (filters.q) {
    conditions.push("(name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\')");
    const q = "%" + filters.q.replace(/[\\%_]/g, "\\$&") + "%";
    parameters.push(q, q);
  }
  const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
  const total = Number(
    db()
      .prepare("SELECT COUNT(*) AS total FROM applications" + where)
      .get(...parameters)!.total,
  );
  const rows = db()
    .prepare(
      `SELECT ${fields} FROM applications${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,
    )
    .all(...parameters, filters.limit, filters.offset)
    .map(map);
  return {
    applications: rows,
    total,
    limit: filters.limit,
    offset: filters.offset,
    nextOffset:
      filters.offset + rows.length < total
        ? filters.offset + rows.length
        : null,
  };
}
export function updateApplication(
  id: string,
  input: {
    expectedVersion?: number;
    status?: Status;
    note?: string;
    metadata?: Record<string, unknown>;
  },
  actor: string,
) {
  return transaction(() => {
    const previous = getApplication(id);
    if (
      input.expectedVersion !== undefined &&
      previous.version !== input.expectedVersion
    )
      throw new StoreError(
        "Application changed. Read the latest version and retry.",
        409,
      );
    const status = input.status || previous.status;
    const metadata = input.metadata
      ? { ...previous.metadata, ...input.metadata }
      : previous.metadata;
    db()
      .prepare(
        "UPDATE applications SET status=?,metadata=?,updated_at=?,version=version+1 WHERE id=?",
      )
      .run(status, JSON.stringify(metadata), new Date().toISOString(), id);
    event(
      id,
      actor,
      input.status && input.status !== previous.status
        ? "status_changed"
        : "updated",
      input.note || null,
      previous.status,
      status,
    );
    return getApplication(id);
  });
}
export function addNote(id: string, note: string, actor: string) {
  return transaction(() => {
    getApplication(id);
    event(id, actor, "note_added", note, null, null);
    db()
      .prepare(
        "UPDATE applications SET updated_at=?,version=version+1 WHERE id=?",
      )
      .run(new Date().toISOString(), id);
    return getApplication(id);
  });
}
export function health() {
  db().prepare("SELECT 1").get();
  return true;
}
