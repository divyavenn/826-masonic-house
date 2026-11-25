"use client";
import { useEffect, useState } from "react";
type Application = {
  id: string;
  name: string;
  phone: string;
  room: string;
  stayType: string;
  moveIn: string;
  moveOut: string | null;
  notes: string | null;
  status: string;
  version: number;
  metadata: Record<string, unknown>;
};
type Activity = {
  id: string;
  createdAt: string;
  actor: string;
  type: string;
  note: string | null;
  toStatus: string | null;
};
const statuses = [
  "new",
  "contacted",
  "viewing_scheduled",
  "viewed",
  "offered",
  "accepted",
  "declined",
  "no_longer_interested",
];
export default function Admin() {
  const [password, setPassword] = useState(""),
    [signedIn, setSignedIn] = useState(false),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("");
  const [applications, setApplications] = useState<Application[]>([]),
    [next, setNext] = useState<number | null>(null),
    [total, setTotal] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Record<string, Activity[]>>({});
  const [loadedFilter, setLoadedFilter] = useState({ q: "", status: "" });
  async function request(path: string, options: RequestInit = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) setSignedIn(false);
      throw new Error(data.error || "Request failed.");
    }
    return data;
  }
  async function load(offset = 0, filter = { q, status }) {
    setBusy(true);
    setError("");
    try {
      const data = await request(
        "/api/applications?" +
          new URLSearchParams({
            ...filter,
            offset: String(offset),
            limit: "25",
          }),
      );
      setSignedIn(true);
      setApplications((old) =>
        offset ? [...old, ...data.applications] : data.applications,
      );
      setNext(data.nextOffset);
      setTotal(data.total);
      setLoadedFilter(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load applications.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load(0, { q: "", status: "" });
  }, []);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setPassword("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  async function update(
    e: React.FormEvent<HTMLFormElement>,
    application: Application,
  ) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    try {
      const data = await request(`/api/applications/${application.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: values.status,
          ...(values.note ? { note: values.note } : {}),
        }),
      });
      setApplications((old) =>
        old.map((a) => (a.id === application.id ? data.application : a)),
      );
      setHistory((old) => ({ ...old, [application.id]: data.activity }));
      form.querySelector<HTMLTextAreaElement>("textarea")!.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }
  async function showHistory(id: string) {
    try {
      const data = await request(`/api/applications/${id}`);
      setHistory((old) => ({ ...old, [id]: data.activity }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load history.");
    }
  }
  async function logout() {
    await request("/api/admin/logout", { method: "POST", body: "{}" });
    setSignedIn(false);
    setApplications([]);
    setError("");
  }
  return (
    <main className="responses">
      <a href="/">826 Masonic Avenue</a>
      <div className="admin-heading">
        <h1>Applications</h1>
        {signedIn && <button onClick={() => void logout()}>Sign out</button>}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!signedIn ? (
        <form onSubmit={login}>
          <label>
            Shared password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button disabled={busy}>Sign in</button>
        </form>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
          >
            <div className="admin-filters">
              <label>
                Name or phone
                <input value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <label>
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">All</option>
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button disabled={busy}>Filter</button>
            <a
              className="button"
              href={
                "/api/applications/export?" + new URLSearchParams(loadedFilter)
              }
            >
              Download CSV
            </a>
          </form>
          <p>
            {total} application{total === 1 ? "" : "s"}
          </p>
          {applications.map((a) => (
            <article className="admin-application" key={a.id}>
              <h2>{a.name}</h2>
              <p>
                <a href={`tel:${a.phone}`}>{a.phone}</a> | Room {a.room} |{" "}
                {a.stayType}
              </p>
              <p>
                {a.moveIn}
                {a.moveOut ? ` to ${a.moveOut}` : ""}
              </p>
              {a.notes && <p className="admin-notes">{a.notes}</p>}
              <small>{a.id}</small>
              <form onSubmit={(e) => void update(e, a)}>
                <label>
                  Status
                  <select name="status" defaultValue={a.status} key={a.status}>
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Internal note
                  <textarea name="note" maxLength={4000} rows={2} />
                </label>
                <button disabled={busy}>Save update</button>
              </form>
              <button onClick={() => void showHistory(a.id)}>
                View history
              </button>
              {history[a.id] && (
                <ul>
                  {history[a.id].map((event) => (
                    <li key={event.id}>
                      {new Date(event.createdAt).toLocaleString()} —{" "}
                      {event.actor}:{" "}
                      {event.note ||
                        event.toStatus?.replaceAll("_", " ") ||
                        event.type}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
          {next !== null && (
            <button
              onClick={() => void load(next, loadedFilter)}
              disabled={busy}
            >
              Load more
            </button>
          )}
        </>
      )}
    </main>
  );
}
