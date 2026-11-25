"use client";
import { useRef, useState } from "react";
import content from "../content.json";
import PhotoGallery from "./photo-gallery";
const headings = ["The House", "The Rooms", "The Roommates"];
const roommateLinks = [
  {
    name: "Diana",
    handle: "@zawadzki_diana",
    url: "https://x.com/zawadzki_diana",
  },
  { name: "Kevin", handle: "@kvdozer", url: "https://x.com/kvdozer" },
];
const isRoommate = (text: string) =>
  text.startsWith("Diana Zawadski") || text.startsWith("Kevin Hopkins");
const chunks: { text: string; images: number[] }[] = [];
for (const paragraph of content) {
  if (!paragraph.text && !paragraph.images.length) continue;
  const last = chunks[chunks.length - 1];
  if (!paragraph.text && paragraph.images.length && last && !last.text)
    last.images.push(...paragraph.images);
  else chunks.push({ text: paragraph.text, images: [...paragraph.images] });
}
export default function Home() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [rooms, setRooms] = useState<string[]>([]);
  const [stay, setStay] = useState("roommate");
  const [moveIn, setMoveIn] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState("");
  function openForm() {
    dialog.current?.showModal();
    document.body.style.overflow = "hidden";
  }
  function closeForm() {
    dialog.current?.close();
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;
    if (!rooms.length) {
      setError("Select Room A, Room B, or both.");
      return;
    }
    setState("sending");
    setError("");
    const form = e.currentTarget;
    const data = {
      ...Object.fromEntries(new FormData(form)),
      room: rooms.length === 2 ? "both" : rooms[0],
    };
    try {
      const r = await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(result.error);
      setState("success");
      form.reset();
      setMoveIn("");
      setRooms([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      setState("");
    }
  }
  return (
    <main className="document-page">
      <section className="address-map">
        <a
          href="https://www.google.com/maps/search/?api=1&query=826%20Masonic%20Avenue%2C%20San%20Francisco%2C%20CA"
          target="_blank"
          rel="noreferrer"
        >
          826 Masonic Avenue
        </a>
        <iframe
          title="826 Masonic Avenue"
          src="https://maps.google.com/maps?q=826%20Masonic%20Avenue%2C%20San%20Francisco%2C%20CA&z=16&output=embed"
          width="100%"
          height="340"
          style={{ border: 0 }}
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      </section>
      {chunks.map((chunk, index) => {
        if (
          (index > 0 && isRoommate(chunks[index - 1].text)) ||
          (index > 1 && isRoommate(chunks[index - 2].text))
        )
          return null;
        if (isRoommate(chunk.text)) {
          const photo = chunks[index + 1]?.images[0];
          const person = roommateLinks[chunk.text.startsWith("Diana") ? 0 : 1];
          const name = chunk.text.replace(/\s*\(@[^)]+\)/, "");
          const bio = chunks[index + 2]?.text || "";
          const nameAt = bio.indexOf(person.name);
          return (
            <article className="roommate-profile" key={index}>
              <button
                type="button"
                className="photo"
                onClick={() => setSelectedPhoto(photo)}
                aria-haspopup="dialog"
                aria-label={`Open photo: ${name}`}
              >
                <img src={`/photos/${photo}.jpg`} alt={name} loading="lazy" />
              </button>
              <div>
                <h3>{name}</h3>
                <p>
                  {bio.slice(0, nameAt)}
                  {person.name} (
                  <a
                    className="social-handle"
                    href={person.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {person.handle}
                  </a>
                  ){bio.slice(nameAt + person.name.length)}
                </p>
              </div>
            </article>
          );
        }
        return (
          <div key={index}>
            {chunk.text &&
              (headings.includes(chunk.text) ? (
                <h2>{chunk.text}</h2>
              ) : chunk.text.startsWith("Room A -") ||
                chunk.text.startsWith("Room B -") ||
                chunk.text.startsWith("Diana Zawadski") ||
                chunk.text.startsWith("Kevin Hopkins") ? (
                <h3>{chunk.text}</h3>
              ) : (
                <p
                  className={
                    [
                      "Third floor",
                      "Shared bathroom",
                      "230 square feet",
                      "Two (!)",
                      "Comes with",
                      "Available December",
                      "Privacy +",
                      "Second floor",
                      "135 square feet",
                      "Tall ceilings",
                    ].some((x) => chunk.text.startsWith(x))
                      ? "doc-bullet"
                      : ""
                  }
                >
                  {chunk.text}
                </p>
              ))}
            {chunk.text.startsWith("The neighborhood") && (
              <section id="interest" className="interest-trigger">
                <button
                  type="button"
                  className="interest-button"
                  onClick={openForm}
                  aria-haspopup="dialog"
                >
                  I'm interested
                </button>
              </section>
            )}

            {chunk.images.length > 0 && (
              <div className={"document-gallery count-" + chunk.images.length}>
                {chunk.images.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="photo"
                    onClick={() => setSelectedPhoto(id)}
                    aria-haspopup="dialog"
                    aria-label={`Open photo ${id + 1}`}
                  >
                    <img
                      src={`/photos/${id}.jpg`}
                      alt={
                        id < 6 || id >= 14
                          ? "The House"
                          : id < 10
                            ? "Room A"
                            : id < 12
                              ? "Room B"
                              : id === 12
                                ? "Diana Zawadski"
                                : "Kevin Hopkins"
                      }
                      loading={id === 0 ? "eager" : "lazy"}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <dialog
        ref={dialog}
        className="interest-modal"
        aria-labelledby="interest-title"
        onClose={() => {
          document.body.style.overflow = "";
        }}
        onClick={(e) => {
          if (e.target === dialog.current) {
            const rect = dialog.current.getBoundingClientRect();
            if (
              e.clientX < rect.left ||
              e.clientX > rect.right ||
              e.clientY < rect.top ||
              e.clientY > rect.bottom
            )
              closeForm();
          }
        }}
      >
        <div className="modal-heading">
          <h2 id="interest-title">I'm interested</h2>
          <button
            type="button"
            className="modal-close"
            onClick={closeForm}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {state === "success" ? (
          <p className="modal-success" role="status">
            Your response has been saved.
          </p>
        ) : (
          <form onSubmit={submit}>
            <div className="form-grid">
              <label>
                Full name
                <input
                  autoComplete="name"
                  name="name"
                  required
                  maxLength={200}
                  autoFocus
                />
              </label>
              <label>
                Phone number
                <input
                  type="tel"
                  autoComplete="tel"
                  name="phone"
                  required
                  maxLength={200}
                />
              </label>
              <fieldset className="wide">
                <legend>Room</legend>
                <div className="room-selectors">
                  {["A", "B"].map((room) => (
                    <label key={room}>
                      <input
                        type="checkbox"
                        name="rooms"
                        value={room}
                        checked={rooms.includes(room)}
                        onChange={(e) => {
                          setRooms((previous) =>
                            e.target.checked
                              ? [...previous, room]
                              : previous.filter((r) => r !== room),
                          );
                          setError("");
                        }}
                      />
                      <span>Room {room}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="wide">
                <legend>Sublet or roommate</legend>
                <div className="choices">
                  {["roommate", "sublet"].map((s) => (
                    <label key={s}>
                      <input
                        type="radio"
                        name="stayType"
                        value={s}
                        checked={stay === s}
                        onChange={() => setStay(s)}
                      />
                      <span>{s === "roommate" ? "Roommate" : "Sublet"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className={stay === "roommate" ? "wide" : ""}>
                Earliest move-in date
                <input
                  type="date"
                  name="moveIn"
                  value={moveIn}
                  onChange={(e) => setMoveIn(e.target.value)}
                  required
                />
              </label>
              {stay === "sublet" && (
                <label>
                  Move-out date
                  <input
                    type="date"
                    name="moveOut"
                    min={
                      moveIn
                        ? new Date(
                            new Date(moveIn + "T00:00:00Z").getTime() +
                              86400000,
                          )
                            .toISOString()
                            .slice(0, 10)
                        : undefined
                    }
                    required
                  />
                </label>
              )}
              <label className="wide">
                Anything else we should know?{" "}
                <span className="optional">(optional)</span>
                <textarea name="notes" rows={3} maxLength={2000} />
              </label>
              <label className="trap" aria-hidden="true">
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button submit" disabled={state === "sending"}>
              {state === "sending" ? "Submitting…" : "Submit"}
            </button>
          </form>
        )}
      </dialog>
      <PhotoGallery
        selected={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
      />
    </main>
  );
}
