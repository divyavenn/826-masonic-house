"use client";
import { useEffect, useRef, useState } from "react";
import content from "../content.json";
const photos = content
  .flatMap((paragraph) => paragraph.images)
  .map((id) => ({
    id,
    alt:
      id < 6 || id >= 14
        ? "The House"
        : id < 10
          ? "Room A"
          : id < 12
            ? "Room B"
            : id === 12
              ? "Diana Zawadski"
              : "Kevin Hopkins",
  }));
export default function PhotoGallery({
  selected,
  onClose,
}: {
  selected: number | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const current = useRef(0);
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (selected === null) return;
    const modal = dialog.current!;
    const scroller = track.current!;
    const overflow = document.body.style.overflow;
    const index = photos.findIndex((photo) => photo.id === selected);
    current.current = index;
    setActive(index);
    modal.showModal();
    document.body.style.overflow = "hidden";
    scroller.scrollTo({
      left: index * scroller.clientWidth,
      behavior: "instant",
    });
    const resize = new ResizeObserver(() =>
      scroller.scrollTo({
        left: current.current * scroller.clientWidth,
        behavior: "instant",
      }),
    );
    resize.observe(scroller);
    return () => {
      resize.disconnect();
      modal.close();
      document.body.style.overflow = overflow;
    };
  }, [selected]);
  function go(index: number) {
    const scroller = track.current;
    if (!scroller) return;
    const target = Math.max(0, Math.min(photos.length - 1, index));
    scroller.scrollTo({
      left: target * scroller.clientWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  return (
    <dialog
      ref={dialog}
      className="photo-spotlight"
      aria-label="Photo gallery"
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          go(current.current + 1);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(current.current - 1);
        }
        if (e.key === "Home") {
          e.preventDefault();
          go(0);
        }
        if (e.key === "End") {
          e.preventDefault();
          go(photos.length - 1);
        }
      }}
    >
      <div className="spotlight-top">
        <span aria-live="polite" aria-atomic="true">
          {active + 1} / {photos.length}
        </span>
        <button
          type="button"
          className="spotlight-close"
          aria-label="Close photo gallery"
          onClick={() => dialog.current?.close()}
          autoFocus
        >
          ×
        </button>
      </div>
      <div
        ref={track}
        className="spotlight-track"
        onScroll={(e) => {
          const scroller = e.currentTarget;
          const index = Math.max(
            0,
            Math.min(
              photos.length - 1,
              Math.round(scroller.scrollLeft / scroller.clientWidth),
            ),
          );
          current.current = index;
          setActive(index);
        }}
      >
        {photos.map((photo, index) => (
          <div key={photo.id} className="spotlight-slide">
            <img
              src={`/photos/${photo.id}.jpg`}
              alt={photo.alt}
              draggable={false}
              loading={
                selected !== null && Math.abs(index - active) <= 1
                  ? "eager"
                  : "lazy"
              }
            />
          </div>
        ))}
      </div>
      <div className="spotlight-controls">
        <button
          type="button"
          onClick={() => go(current.current - 1)}
          disabled={active === 0}
        >
          Previous
        </button>
        <div className="spotlight-thumbnails" aria-label="Photos">
          {photos.map((photo, index) => (
            <button
              type="button"
              key={photo.id}
              aria-label={`Photo ${index + 1}: ${photo.alt}`}
              aria-current={active === index ? "true" : undefined}
              onClick={() => go(index)}
            >
              <img src={`/photos/${photo.id}.jpg`} alt="" loading="lazy" />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(current.current + 1)}
          disabled={active === photos.length - 1}
        >
          Next
        </button>
      </div>
    </dialog>
  );
}
