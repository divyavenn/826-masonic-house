"use client";
import { useEffect, useRef, useState } from "react";
type Application = {
  id: string;
  createdAt: string;
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
  latestInternalNote: string | null;
  internalNotes: string | null;
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
const label = (value: string) => value.replaceAll("_", " ");
export default function Admin() {
  const [password, setPassword] = useState(""),
    [signedIn, setSignedIn] = useState(false),
    [checking, setChecking] = useState(true),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("");
  const [applications, setApplications] = useState<Application[]>([]),
    [next, setNext] = useState<number | null>(null),
    [total, setTotal] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({}),
    [saved, setSaved] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Record<string, Activity[]>>({}),
    [selected, setSelected] = useState<Application | null>(null),
    [note, setNote] = useState("");
  const [loadedFilter, setLoadedFilter] = useState({ q: "", status: "" });
  const noteDialog = useRef<HTMLDialogElement>(null);
  async function request(path: string, options: RequestInit = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) setSignedIn(false);
      throw Object.assign(new Error(data.error || "Request failed."), {
        status: response.status,
      });
    }
    return data;
  }
  async function load(offset = 0, filter = { q, status }, quiet = false) {
    setBusy(true);
    setError("");
    try {
      const data = await request(
        "/api/applications?" +
          new URLSearchParams({
            ...filter,
            offset: String(offset),
            limit: "50",
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
      if (!(quiet && (e as { status?: number }).status === 401))
        setError(
          e instanceof Error ? e.message : "Unable to load applications.",
        );
    } finally {
      setBusy(false);
      setChecking(false);
    }
  }
  useEffect(() => {
    void load(0, { q: "", status: "" }, true);
  }, []);
  useEffect(() => {
    if (!selected) return;
    const dialog = noteDialog.current!;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
    };
  }, [selected?.id]);
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
  function apply(data: { application: Application; activity: Activity[] }) {
    setApplications((old) =>
      old.map((a) => (a.id === data.application.id ? data.application : a)),
    );
    setHistory((old) => ({ ...old, [data.application.id]: data.activity }));
    setSelected((old) =>
      old?.id === data.application.id ? data.application : old,
    );
  }
  async function changeStatus(application: Application, value: string) {
    setSaving((old) => ({ ...old, [application.id]: true }));
    setError("");
    try {
      const data = await request(`/api/applications/${application.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: value }),
      });
      apply(data);
      setSaved((old) => ({ ...old, [application.id]: "Saved" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setSaving((old) => ({ ...old, [application.id]: false }));
    }
  }
  async function openNotes(application: Application) {
    setNote("");
    setSelected(application);
    setError("");
    try {
      const data = await request(`/api/applications/${application.id}`);
      apply(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load notes.");
    }
  }
  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const id = selected.id;
    setSaving((old) => ({ ...old, [id]: true }));
    setError("");
    try {
      const data = await request(`/api/applications/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ text: note }),
      });
      apply(data);
      setNote("");
      setSaved((old) => ({ ...old, [id]: "Note saved" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save note.");
    } finally {
      setSaving((old) => ({ ...old, [id]: false }));
    }
  }
  async function logout() {
    try {
      await request("/api/admin/logout", { method: "POST", body: "{}" });
      setSignedIn(false);
      setApplications([]);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-out failed.");
    }
  }
  return (
    <main
      className={
        "responses " + (signedIn ? "spreadsheet-admin" : "admin-login")
      }
    >
      <a className="admin-home" href="/">
        826 Masonic Avenue
      </a>
      <div className="admin-heading">
        <div>
          <h1>Applications</h1>
          {signedIn && (
            <p className="record-count">
              {total} response{total === 1 ? "" : "s"}
            </p>
          )}
        </div>
        {signedIn && <button onClick={() => void logout()}>Sign out</button>}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {checking ? (
        <p role="status">Loading…</p>
      ) : !signedIn ? (
        <form onSubmit={login} className="admin-login-form">
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
            className="sheet-toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
          >
            <label className="sheet-search">
              Name or phone
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search responses"
              />
            </label>
            <label className="sheet-filter">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy}>Filter</button>
            <a
              className="button sheet-export"
              href={
                "/api/applications/export?" + new URLSearchParams(loadedFilter)
              }
            >
              Download CSV
            </a>
          </form>
          <div
            className="sheet-scroll"
            role="region"
            aria-label="Applications spreadsheet"
            tabIndex={0}
          >
            <table className="applications-sheet">
              <thead>
                <tr>
                  <th scope="col" className="row-number">
                    #
                  </th>
                  <th scope="col" className="name-column">
                    Name
                  </th>
                  <th scope="col">Phone</th>
                  <th scope="col">Room</th>
                  <th scope="col">Stay</th>
                  <th scope="col">Move-in</th>
                  <th scope="col">Move-out</th>
                  <th scope="col">Status</th>
                  <th scope="col">Applicant notes</th>
                  <th scope="col">Internal notes</th>
                  <th scope="col">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((a, index) => {
                  const internalNotes =
                    history[a.id]
                      ?.filter((event) => event.note)
                      .map((event) => event.note)
                      .join("\n\n") ??
                    a.internalNotes ??
                    a.latestInternalNote;
                  return (
                    <tr key={a.id}>
                      <td className="row-number">{index + 1}</td>
                      <th scope="row" className="name-column">
                        <button
                          className="sheet-name"
                          onClick={() => void openNotes(a)}
                        >
                          {a.name}
                        </button>
                      </th>
                      <td>
                        <a href={`tel:${a.phone}`}>{a.phone}</a>
                      </td>
                      <td>{a.room === "both" ? "A + B" : a.room}</td>
                      <td>{a.stayType}</td>
                      <td>{a.moveIn}</td>
                      <td>{a.moveOut || "—"}</td>
                      <td className="status-cell">
                        <select
                          value={a.status}
                          aria-label={`Status for ${a.name}`}
                          data-status={a.status}
                          onChange={(e) => void changeStatus(a, e.target.value)}
                          disabled={saving[a.id]}
                        >
                          {statuses.map((s) => (
                            <option key={s} value={s}>
                              {label(s)}
                            </option>
                          ))}
                        </select>
                        <span className="cell-save-state" role="status">
                          {saving[a.id] ? "Saving…" : saved[a.id] || ""}
                        </span>
                      </td>
                      <td className="sheet-note">
                        <div
                          className="sheet-note-scroll"
                          role="region"
                          tabIndex={0}
                          aria-label={`Applicant notes for ${a.name}`}
                        >
                          {a.notes || "—"}
                        </div>
                      </td>
                      <td className="sheet-note">
                        <div
                          className="sheet-note-scroll"
                          role="region"
                          tabIndex={0}
                          aria-label={`Internal notes for ${a.name}`}
                        >
                          {internalNotes || "—"}
                        </div>
                        <button
                          className="sheet-note-button"
                          onClick={() => void openNotes(a)}
                          aria-label={`Notes and history for ${a.name}`}
                        >
                          Notes & history
                        </button>
                      </td>
                      <td className="submitted-cell">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {applications.length === 0 && (
              <div className="sheet-empty">
                {busy
                  ? "Loading responses…"
                  : total === 0 && !loadedFilter.q && !loadedFilter.status
                    ? "No responses yet."
                    : "No matching responses."}
              </div>
            )}
          </div>
          <div className="sheet-footer">
            <span>
              {applications.length} of {total} responses
            </span>
            {next !== null && (
              <button
                onClick={() => void load(next, loadedFilter)}
                disabled={busy}
              >
                Load more
              </button>
            )}
          </div>
        </>
      )}
      <dialog
        ref={noteDialog}
        className="interest-modal application-detail"
        aria-labelledby="application-detail-title"
        onClose={() => setSelected(null)}
      >
        <div className="modal-heading">
          <h2 id="application-detail-title">{selected?.name}</h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Close application details"
            onClick={() => noteDialog.current?.close()}
          >
            ×
          </button>
        </div>
        {selected && (
          <>
            <p>
              <a href={`tel:${selected.phone}`}>{selected.phone}</a>
            </p>
            {selected.notes && (
              <div className="original-note">
                <h3>Applicant notes</h3>
                <p>{selected.notes}</p>
              </div>
            )}
            <form onSubmit={addNote}>
              <label>
                Internal note
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  required
                  maxLength={4000}
                  rows={3}
                />
              </label>
              <button disabled={saving[selected.id]}>
                {saving[selected.id] ? "Saving…" : "Add note"}
              </button>
            </form>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <h3>History</h3>
            {history[selected.id] ? (
              <ol className="application-history">
                {history[selected.id].map((event) => (
                  <li key={event.id}>
                    <span>
                      {new Date(event.createdAt).toLocaleString()} ·{" "}
                      {event.actor}
                    </span>
                    <p>{event.note || label(event.toStatus || event.type)}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Loading history…</p>
            )}
            <small className="application-id">{selected.id}</small>
          </>
        )}
      </dialog>
    </main>
  );
}
