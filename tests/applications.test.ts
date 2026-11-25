import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const folder = mkdtempSync(join(tmpdir(), "house-applications-"));
process.env.DATABASE_PATH = join(folder, "test.sqlite");
process.env.ADMIN_PASSWORD = "test-shared-password";

const {
  createApplication,
  getApplication,
  listApplications,
  updateApplication,
  addNote,
  activity,
} = await import("../lib/store.ts");
const { authorize } = await import("../lib/http.ts");
after(() => rmSync(folder, { recursive: true, force: true }));
test("applications keep status, notes, metadata and history, and reject stale updates", () => {
  const application = createApplication({
    name: "Test Person",
    phone: "4155551234",
    room: "both",
    moveIn: "2026-12-01",
    stayType: "roommate",
    moveOut: null,
    notes: "Looking for a quiet room.",
  });
  assert.equal(application.status, "new");
  assert.equal(application.version, 1);
  const updated = updateApplication(
    application.id,
    {
      expectedVersion: 1,
      status: "no_longer_interested",
      note: "Applicant withdrew by phone.",
      metadata: { contactedBy: "host" },
    },
    "test-agent",
  );
  assert.equal(updated.status, "no_longer_interested");
  assert.equal(updated.version, 2);
  assert.equal(updated.metadata.contactedBy, "host");
  assert.equal(updated.notes, application.notes);
  assert.throws(
    () =>
      updateApplication(
        application.id,
        { expectedVersion: 1, status: "accepted" },
        "another-agent",
      ),
    /Application changed/,
  );
  addNote(application.id, "Recontact if availability changes.", "test-agent");
  assert.equal(getApplication(application.id).version, 3);
  assert.equal(
    getApplication(application.id).internalNotes,
    "Applicant withdrew by phone.\n\nRecontact if availability changes.",
  );
  assert.equal(
    getApplication(application.id).latestInternalNote,
    "Recontact if availability changes.",
  );
  assert.equal(activity(application.id).length, 3);
  assert.equal(
    listApplications({
      status: "no_longer_interested",
      room: "A",
      limit: 1,
      offset: 0,
    }).total,
    1,
  );
  assert.equal(
    listApplications({ q: "Test Person", limit: 1, offset: 0 }).applications[0]
      .id,
    application.id,
  );
  assert.equal(listApplications({ q: "%", limit: 1, offset: 0 }).total, 0);
});
test("one shared password works for both querying and updating", () => {
  const request = (key: string) =>
    new Request("http://localhost/api/applications", {
      headers: { Authorization: `Bearer ${key}` },
    });
  assert.throws(() => authorize(request("incorrect")), /shared password/);
  assert.doesNotThrow(() => authorize(request("test-shared-password")));
  assert.doesNotThrow(() => authorize(request("test-shared-password"), true));
});
test("updates do not require version checks", () => {
  const app = createApplication({
    name: "Simple Update",
    phone: "4155551234",
    room: "A",
    moveIn: "2026-12-01",
    stayType: "roommate",
    moveOut: null,
    notes: null,
  });
  assert.equal(
    updateApplication(app.id, { status: "no_longer_interested" }, "program")
      .status,
    "no_longer_interested",
  );
});
test("browser session uses the same password and rejects cross-site cookie writes", async () => {
  const { createSession, cookieName, hasSession } =
    await import("../lib/auth.ts");
  const token = createSession();
  const headers = {
    Cookie: `${cookieName}=${token}`,
    Host: "localhost",
    Origin: "http://localhost",
  };
  assert(
    hasSession(new Request("http://localhost/api/applications", { headers })),
  );
  assert.doesNotThrow(() =>
    authorize(
      new Request("http://localhost/api/applications", {
        method: "PATCH",
        headers,
      }),
      true,
    ),
  );
  assert.throws(
    () =>
      authorize(
        new Request("http://localhost/api/applications", {
          method: "PATCH",
          headers: { ...headers, Origin: "https://another.example" },
        }),
        true,
      ),
    /this website/,
  );
});
