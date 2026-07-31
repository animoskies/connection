"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";

type PublicPhoto = {
  id: string;
  owner: string;
  ownerName: string;
  ownerAvatar: string;
  title: string;
  caption: string;
  location: string;
  src: string;
  takenAt: string;
  createdAt: string;
};

function photoTime(photo: PublicPhoto) {
  const date = DateTime.fromISO(photo.takenAt || photo.createdAt);
  return date.isValid ? date.toFormat("LLL d, yyyy h:mm a") : "";
}

function Avatar({ name, src }: { name: string; src: string }) {
  if (src) {
    return <img alt={name} className="h-10 w-10 rounded-full object-cover" src={src} />;
  }

  return (
    <span className="grid h-10 w-10 place-items-center rounded-full bg-[#9bc4d7] text-sm font-semibold text-black">
      {(name || "C").slice(0, 1).toUpperCase()}
    </span>
  );
}

export function PublicPhotoPageClient({ token }: { token: string }) {
  const [photo, setPhoto] = useState<PublicPhoto | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPhoto() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/public/photos/${encodeURIComponent(token)}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Photo not found.");
        if (!cancelled) setPhoto(payload.photo);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Photo not found.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (token) void loadPhoto();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="min-h-screen bg-[#151512] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col">
        <header className="flex items-center justify-center border-b border-white/10 px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
          <p className="text-lg font-semibold">Connection</p>
        </header>

        {loading ? (
          <div className="grid flex-1 place-items-center px-6 text-center text-white/60">
            Loading shared photo...
          </div>
        ) : error ? (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div>
              <h1 className="text-2xl font-semibold">Photo unavailable</h1>
              <p className="mt-2 text-sm text-white/55">{error}</p>
            </div>
          </div>
        ) : photo ? (
          <>
            <div className="min-h-0 flex-1 bg-black">
              <img alt={photo.title} className="h-full w-full object-contain" src={photo.src} />
            </div>
            <section className="shrink-0 border-t border-white/10 bg-[#1d1d1a] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-3">
                <Avatar name={photo.owner} src={photo.ownerAvatar} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{photo.owner}</p>
                  <p className="truncate text-xs text-white/50">{photoTime(photo)}</p>
                </div>
              </div>
              {photo.location ? <p className="mt-3 text-xs text-white/50">{photo.location}</p> : null}
              {photo.caption ? <p className="mt-3 text-base font-medium leading-6">{photo.caption}</p> : null}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
