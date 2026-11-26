import { test, after } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const folder = mkdtempSync(join(tmpdir(), "house-email-migration-"));
const path = join(folder, "legacy.sqlite");
const old = new DatabaseSync(path);
old.exec(
  `CREATE TABLE applications(id TEXT PRIMARY KEY,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,room TEXT NOT NULL,move_in TEXT NOT NULL,stay_type TEXT NOT NULL,move_out TEXT,notes TEXT,status TEXT NOT NULL DEFAULT 'new',version INTEGER NOT NULL DEFAULT 1,metadata TEXT NOT NULL DEFAULT '{}'); INSERT INTO applications VALUES('old-id','2026-11-01','2026-11-01','Existing Applicant','4155551234','A','2026-12-01','roommate',NULL,'Keep this note','contacted',3,'{}'); PRAGMA user_version=1;`,
);
old.close();
process.env.DATABASE_PATH = path;
const { getApplication, createApplication } = await import("../lib/store.ts");
after(() => rmSync(folder, { recursive: true, force: true }));
test("email migration preserves existing applications and stores email on new responses", () => {
  const existing = getApplication("old-id");
  assert.equal(existing.email, null);
  assert.equal(existing.status, "contacted");
  assert.equal(existing.version, 3);
  assert.equal(existing.notes, "Keep this note");
  const added = createApplication({
    name: "New Applicant",
    phone: "4155551234",
    email: "person@example.com",
    room: "B",
    moveIn: "2026-12-01",
    stayType: "roommate",
    moveOut: null,
    notes: null,
  });
  assert.equal(getApplication(added.id).email, "person@example.com");
});
