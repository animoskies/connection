"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Check,
  Clock3,
  Image as ImageIcon,
  Info,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  Sun,
  Trash2,
  User,
  UserPlus,
  Users
} from "lucide-react";
import { DateTime } from "luxon";
import { clsx } from "clsx";
import { createSupabaseClient, hasSupabaseConfig } from "@/lib/supabase";
import { browserTimezone, timezones } from "@/lib/timezones";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  preferred_timezone: string;
  avatar_url: string | null;
};

type Group = {
  id: string;
  name: string;
  owner_id: string;
  role: "owner" | "editor" | "viewer";
  member_count: number;
};

type EventItem = {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at_utc: string;
  source_timezone: string;
  creator_id: string;
  created_at: string;
};

type ViewMode = "agenda" | "week" | "month";
type AppTab = "gallery" | "connections" | "groups" | "calendar" | "profile";

type PhotoItem = {
  id: string;
  ownerId: string;
  title: string;
  owner: string;
  ownerAvatar: string;
  groupId: string | null;
  group: string;
  shareScope: "private" | "connections" | "group";
  location: string;
  caption: string;
  src: string;
  storagePath: string;
  takenAt: string;
  createdAt: string;
  tags: string[];
};

const supabase = hasSupabaseConfig ? createSupabaseClient() : null;
const memoryPhotoClass = "h-full w-full object-cover grayscale contrast-125 brightness-90";
const retroPhotoSize = 640;
const retroPhotoQuality = 0.56;
const avatarPhotoSize = 320;
type OpenPhoto = (id: string, photos: PhotoItem[]) => void;
type ShareTarget =
  | { type: "connections" }
  | { type: "group"; groupId: string };

function localDateTime(event: EventItem, timezone: string) {
  return DateTime.fromISO(event.starts_at_utc, { zone: "utc" }).setZone(timezone);
}

function sourceDateTime(event: EventItem) {
  return DateTime.fromISO(event.starts_at_utc, { zone: "utc" }).setZone(event.source_timezone);
}

function photoDate(photo: PhotoItem) {
  return DateTime.fromISO(photo.takenAt || photo.createdAt);
}

function photoTime(photo: PhotoItem) {
  const date = photoDate(photo);
  if (!date.isValid) return "Recently";
  const now = DateTime.now();
  const prefix =
    date.hasSame(now, "day")
      ? "Today"
      : date.hasSame(now.minus({ days: 1 }), "day")
        ? "Yesterday"
        : date.toFormat("LLL d");
  return `${prefix} at ${date.toFormat("h:mm a")}`;
}

function photoSectionLabel(photo: PhotoItem) {
  const date = photoDate(photo);
  if (!date.isValid) return "Recently";
  const now = DateTime.now();
  if (date.hasSame(now, "day")) return "Today";
  if (date.hasSame(now.minus({ days: 1 }), "day")) return "Yesterday";
  return date.toFormat("LLL d");
}

function groupPhotosByDate(photos: PhotoItem[]) {
  const groups = new Map<string, PhotoItem[]>();
  photos.forEach((photo) => {
    const label = photoSectionLabel(photo);
    groups.set(label, [...(groups.get(label) ?? []), photo]);
  });
  return Array.from(groups.entries());
}

function dataUrlToBlob(dataUrl: string) {
  const [meta, data] = dataUrl.split(",");
  const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
  const bytes = atob(data);
  const array = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) {
    array[index] = bytes.charCodeAt(index);
  }
  return new Blob([array], { type: mime });
}

function imageFileToAvatarBlob(file: File) {
  return new Promise<Blob>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = avatarPhotoSize;
      canvas.height = avatarPhotoSize;
      const size = Math.min(image.naturalWidth, image.naturalHeight);
      const sourceX = Math.max(0, (image.naturalWidth - size) / 2);
      const sourceY = Math.max(0, (image.naturalHeight - size) / 2);
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Could not prepare profile picture."));
        return;
      }
      context.drawImage(image, sourceX, sourceY, size, size, 0, 0, avatarPhotoSize, avatarPhotoSize);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not prepare profile picture."));
      }, "image/jpeg", 0.72);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    image.src = url;
  });
}

export default function Home() {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("gallery");
  const [calendarGroupId, setCalendarGroupId] = useState("all");
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [viewerPhotoIds, setViewerPhotoIds] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingCaptureSrc, setPendingCaptureSrc] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [view, setView] = useState<ViewMode>("agenda");
  const [selectedDate, setSelectedDate] = useState(DateTime.now().toISODate());
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [message, setMessage] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        const updateKey = "connection-sw-updated";
        if (sessionStorage.getItem(updateKey)) return;
        sessionStorage.setItem(updateKey, "true");
        window.location.reload();
      });
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          registration.update().catch(() => undefined);
          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            worker?.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) {
                worker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });
        })
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSessionUserId(data.session?.user.id ?? null);
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionUserId) {
      setProfile(null);
      setGroups([]);
      setEvents([]);
      setPhotos([]);
      return;
    }

    void loadWorkspace(sessionUserId);
  }, [sessionUserId]);

  async function loadWorkspace(userId = sessionUserId) {
    if (!supabase || !userId) return;
    setLoading(true);
    setMessage("");

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) setMessage(profileError.message);
    setProfile(profileData);

    const { data: membershipData, error: membershipError } = await supabase
      .from("group_members")
      .select("role, groups(id, name, owner_id)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (membershipError) {
      setMessage(membershipError.message);
      setLoading(false);
      return;
    }

    const loadedGroups =
      membershipData?.flatMap((membership) => {
        const group = Array.isArray(membership.groups)
          ? membership.groups[0]
          : membership.groups;
        return group
          ? [
              {
                id: group.id,
                name: group.name,
                owner_id: group.owner_id,
                role: membership.role,
                member_count: 1
              } as Group
            ]
          : [];
      }) ?? [];

    if (loadedGroups.length) {
      const { data: allMemberRows, error: memberCountError } = await supabase
        .from("group_members")
        .select("group_id")
        .in(
          "group_id",
          loadedGroups.map((group) => group.id)
        );

      if (memberCountError) {
        setMessage(memberCountError.message);
      } else {
        const memberCounts = new Map<string, number>();
        allMemberRows?.forEach((member) => {
          memberCounts.set(member.group_id, (memberCounts.get(member.group_id) ?? 0) + 1);
        });
        loadedGroups.forEach((group) => {
          group.member_count = memberCounts.get(group.id) ?? 1;
        });
      }
    }

    setGroups(loadedGroups);
    setActiveGroupId((currentGroupId) =>
      currentGroupId && loadedGroups.some((group) => group.id === currentGroupId) ? currentGroupId : null
    );

    if (loadedGroups.length) {
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .in(
          "group_id",
          loadedGroups.map((group) => group.id)
        )
        .order("starts_at_utc", { ascending: true });

      if (eventError) setMessage(eventError.message);
      setEvents(eventData ?? []);
    } else {
      setEvents([]);
    }

    await loadPhotos();

    setLoading(false);
  }

  async function authHeaders() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : null;
  }

  async function loadPhotos() {
    const headers = await authHeaders();
    if (!headers) {
      setPhotoUploading(false);
      return;
    }

    const response = await fetch("/api/photos", { headers });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Could not load photos.");
      return;
    }

    setPhotos(payload.photos ?? []);
  }

  function openPhoto(id: string, sourcePhotos: PhotoItem[]) {
    setViewerPhotoIds(sourcePhotos.map((photo) => photo.id));
    setSelectedPhotoId(id);
  }

  async function uploadCapturedPhoto(src: string, target: ShareTarget) {
    if (!supabase || !profile) return;

    setPhotoUploading(true);
    setMessage("");
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData.user;
    if (userError || !user) {
      setMessage("Authentication required.");
      setPhotoUploading(false);
      return;
    }

    const photoId = crypto.randomUUID();
    const storagePath = `${user.id}/${photoId}.jpg`;
    const blob = dataUrlToBlob(src);
    const { error: uploadError } = await supabase.storage
      .from("connection-photos")
      .upload(storagePath, blob, {
        contentType: "image/jpeg",
        upsert: false
      });

    if (uploadError) {
      setMessage(uploadError.message);
      setPhotoUploading(false);
      return;
    }

    const headers = await authHeaders();
    if (!headers) return;

    const groupId = target.type === "group" ? target.groupId : null;

    const response = await fetch("/api/photos", {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: "Untitled memory",
        caption: "Captured in black and white.",
        location: "",
        groupId,
        shareScope: target.type === "group" ? "group" : "connections",
        storagePath,
        takenAt: new Date().toISOString(),
        tags: ["retro"]
      })
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Could not save photo.");
      await supabase.storage.from("connection-photos").remove([storagePath]);
      setPhotoUploading(false);
      return;
    }

    setPhotos((currentPhotos) => [payload.photo, ...currentPhotos]);
    setViewerPhotoIds([payload.photo.id]);
    setSelectedPhotoId(payload.photo.id);
    setPendingCaptureSrc(null);
    setPhotoUploading(false);
  }

  async function deletePhoto(photo: PhotoItem) {
    const headers = await authHeaders();
    if (!headers) return;

    const response = await fetch(`/api/photos/${photo.id}`, {
      method: "DELETE",
      headers
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Could not delete photo.");
      return;
    }

    setPhotos((currentPhotos) => currentPhotos.filter((item) => item.id !== photo.id));
    const remainingViewerIds = viewerPhotoIds.filter((id) => id !== photo.id);
    setViewerPhotoIds(remainingViewerIds);
    setSelectedPhotoId(remainingViewerIds[0] ?? null);
  }

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? null;
  const allPhotos = photos;
  const homePhotos = photos.filter((photo) => photo.groupId === null);
  const connectionPhotos = homePhotos.filter((photo) => photo.shareScope === "connections");
  const selectedPhoto = allPhotos.find((photo) => photo.id === selectedPhotoId) ?? null;
  const viewerPhotos = viewerPhotoIds
    .map((id) => allPhotos.find((photo) => photo.id === id))
    .filter((photo): photo is PhotoItem => Boolean(photo));
  const preferredTimezone = profile?.preferred_timezone ?? browserTimezone();
  const calendarEvents =
    calendarGroupId === "all" ? events : events.filter((event) => event.group_id === calendarGroupId);
  const calendarGroup = groups.find((group) => group.id === calendarGroupId) ?? null;
  const selectedDayEvents = useMemo(() => {
    return calendarEvents.filter((event) => localDateTime(event, preferredTimezone).toISODate() === selectedDate);
  }, [calendarEvents, preferredTimezone, selectedDate]);

  if (!hasSupabaseConfig) {
    return <ConfigScreen />;
  }

  if (loading && !sessionUserId) {
    return <ShellStatus label="Opening" />;
  }

  if (!sessionUserId) {
    return <AuthScreen setMessage={setMessage} message={message} />;
  }

  if (!profile) {
    return (
      <ProfileSetup
        userId={sessionUserId}
        setMessage={setMessage}
        message={message}
        onComplete={() => loadWorkspace(sessionUserId)}
      />
    );
  }

  return (
    <main className="min-h-screen px-4 pb-24 pt-5 text-ink dark:text-paper sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          <div className="text-2xl font-semibold leading-none text-ink dark:text-paper sm:text-3xl">
            Connection
          </div>
          <div className="relative flex items-center gap-2">
            <button
              aria-label="Open camera"
              className="grid h-11 w-11 place-items-center bg-ink text-paper dark:bg-paper dark:text-ink"
              onClick={() => setCameraOpen(true)}
              type="button"
            >
              <Camera size={18} />
            </button>
            <button
              aria-label="Account settings"
              className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white/90 text-ink shadow-sm dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
              onClick={() => setAccountOpen((value) => !value)}
            >
              <Avatar name={profile.display_name} src={profile.avatar_url ?? ""} size="sm" />
            </button>
            {accountOpen ? (
              <AccountMenu
                darkMode={darkMode}
                profile={profile}
                reload={() => loadWorkspace()}
                setDarkMode={setDarkMode}
                setMessage={setMessage}
              />
            ) : null}
          </div>
        </header>

        {message ? (
          <div className="rounded-md border border-rust/40 bg-rust/15 px-4 py-3 text-sm text-rust dark:text-[#ffb49a]">
            {message}
          </div>
        ) : null}

        {activeTab === "gallery" ? (
          <GalleryView openPhoto={openPhoto} photos={homePhotos} />
        ) : null}

        {activeTab === "connections" ? (
          <ConnectionsView openPhoto={openPhoto} photos={connectionPhotos} />
        ) : null}

        {activeTab === "groups" ? (
          <GroupsView
            activeGroup={activeGroup}
            activeGroupId={activeGroupId}
            groups={groups}
            photos={allPhotos}
            reload={() => loadWorkspace()}
            setActiveGroupId={setActiveGroupId}
            setMessage={setMessage}
            openPhoto={openPhoto}
          />
        ) : null}

        {activeTab === "calendar" ? (
          <CalendarView
            calendarGroup={calendarGroup}
            calendarGroupId={calendarGroupId}
            events={calendarEvents}
            groups={groups}
            profile={profile}
            reload={() => loadWorkspace()}
            selectedDayEvents={selectedDayEvents}
            selectedDate={selectedDate}
            setCalendarGroupId={setCalendarGroupId}
            setMessage={setMessage}
            setSelectedDate={setSelectedDate}
            setView={setView}
            timezone={preferredTimezone}
            view={view}
          />
        ) : null}

        {activeTab === "profile" ? (
          <ProfileView openPhoto={openPhoto} photos={allPhotos} profile={profile} setAccountOpen={setAccountOpen} />
        ) : null}
      </div>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {selectedPhoto ? (
        <PhotoViewer
          onDelete={deletePhoto}
          photo={selectedPhoto}
          photos={viewerPhotos.length ? viewerPhotos : allPhotos}
          setSelectedPhotoId={setSelectedPhotoId}
        />
      ) : null}
      {cameraOpen ? (
        <RetroCamera
          onClose={() => setCameraOpen(false)}
          onCapture={(src) => {
            setPendingCaptureSrc(src);
            setCameraOpen(false);
          }}
        />
      ) : null}
      {pendingCaptureSrc ? (
        <SharePhotoSheet
          groups={groups}
          photoUploading={photoUploading}
          src={pendingCaptureSrc}
          onCancel={() => setPendingCaptureSrc(null)}
          onShare={(target) => void uploadCapturedPhoto(pendingCaptureSrc, target)}
        />
      ) : null}
    </main>
  );
}

function GalleryView({
  openPhoto,
  photos,
}: {
  openPhoto: OpenPhoto;
  photos: PhotoItem[];
}) {
  const sections = groupPhotosByDate(photos);

  if (!photos.length) {
    return <EmptyPanel title="No photos yet" body="Use the camera to capture your first black-and-white memory." />;
  }

  return (
    <section className="flex flex-col gap-7">
      {sections.map(([label, sectionPhotos]) => (
        <PhotoSection key={label} label={label} openPhoto={openPhoto} photos={sectionPhotos} sourcePhotos={photos} />
      ))}
    </section>
  );
}

function ConnectionsView({
  openPhoto,
  photos
}: {
  openPhoto: OpenPhoto;
  photos: PhotoItem[];
}) {
  const owners = [...new Set(photos.map((photo) => photo.ownerId))];

  if (!photos.length) {
    return <EmptyPanel title="No connections yet" body="Shared photos will appear here grouped by person." />;
  }

  return (
    <section className="flex flex-col gap-7">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Connections</h1>
        <button className="grid h-10 w-10 place-items-center text-ink dark:text-paper" type="button">
          <Search size={22} />
        </button>
      </div>

      {owners.map((owner) => {
        const ownerPhotos = photos.filter((photo) => photo.ownerId === owner);
        const ownerName = ownerPhotos[0]?.owner ?? "Someone";
        return (
          <section key={owner}>
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={ownerName} src={ownerPhotos[0]?.ownerAvatar} />
              <div>
                <h2 className="font-semibold">{ownerName}</h2>
                <p className="text-xs text-ink/55 dark:text-paper/55">
                  {photoTime(ownerPhotos[0])} • {ownerPhotos.length} photos
                </p>
              </div>
            </div>
            <PhotoStrip openPhoto={openPhoto} photos={ownerPhotos} sourcePhotos={ownerPhotos} />
          </section>
        );
      })}
    </section>
  );
}

function GroupsView({
  activeGroup,
  activeGroupId,
  groups,
  openPhoto,
  photos,
  reload,
  setActiveGroupId,
  setMessage
}: {
  activeGroup: Group | null;
  activeGroupId: string | null;
  groups: Group[];
  openPhoto: OpenPhoto;
  photos: PhotoItem[];
  reload: () => void;
  setActiveGroupId: (id: string | null) => void;
  setMessage: (value: string) => void;
}) {
  const selectedGroupPhotos = activeGroup
    ? photos.filter((photo) => photo.groupId === activeGroup.id)
    : [];

  return (
    <section className="flex flex-col gap-7">
      {!activeGroup ? (
        <GroupPanel
          activeGroupId={activeGroupId}
          groups={groups}
          photos={photos}
          reload={reload}
          setActiveGroupId={setActiveGroupId}
          setMessage={setMessage}
        />
      ) : (
        <GroupGallery
          group={activeGroup}
          openPhoto={openPhoto}
          photos={selectedGroupPhotos}
          reload={reload}
          setActiveGroupId={setActiveGroupId}
          setMessage={setMessage}
        />
      )}
    </section>
  );
}

function ProfileView({
  openPhoto,
  photos,
  profile,
  setAccountOpen
}: {
  openPhoto: OpenPhoto;
  photos: PhotoItem[];
  profile: Profile;
  setAccountOpen: (value: boolean) => void;
}) {
  const ownPhotos = photos.filter((photo) => photo.ownerId === profile.id);

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-lg border border-white/70 bg-white/85 p-5 text-center shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#242420]">
        <Avatar name={profile.display_name} src={profile.avatar_url ?? ""} size="lg" className="mx-auto" />
        <h1 className="mt-3 text-2xl font-semibold">{profile.display_name}</h1>
        <p className="text-sm text-ink/55 dark:text-paper/55">@{profile.username}</p>
        <p className="mt-1 text-sm text-ink/55 dark:text-paper/55">{ownPhotos.length} photos</p>
        <button className="mt-4 rounded-full border border-line px-4 py-2 text-sm" onClick={() => setAccountOpen(true)}>
          Settings
        </button>
      </div>
      {ownPhotos.length ? (
        <PhotoSection label="Your photos" openPhoto={openPhoto} photos={ownPhotos} sourcePhotos={ownPhotos} />
      ) : (
        <EmptyPanel title="No photos yet" body="Your captured photos will live here." />
      )}
    </section>
  );
}

function CalendarView({
  calendarGroup,
  calendarGroupId,
  events,
  groups,
  profile,
  reload,
  selectedDayEvents,
  selectedDate,
  setCalendarGroupId,
  setMessage,
  setSelectedDate,
  setView,
  timezone,
  view
}: {
  calendarGroup: Group | null;
  calendarGroupId: string;
  events: EventItem[];
  groups: Group[];
  profile: Profile;
  reload: () => void;
  selectedDayEvents: EventItem[];
  selectedDate: string;
  setCalendarGroupId: (id: string) => void;
  setMessage: (value: string) => void;
  setSelectedDate: (value: string) => void;
  setView: (view: ViewMode) => void;
  timezone: string;
  view: ViewMode;
}) {
  const writableGroup = calendarGroup ?? groups[0] ?? null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <select
          className="max-w-[11rem] rounded-full border border-line bg-white px-3 py-2 text-sm text-ink outline-none dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
          value={calendarGroupId}
          onChange={(event) => setCalendarGroupId(event.target.value)}
        >
          <option value="all">All groups</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex rounded-full border border-line bg-paper p-1 dark:border-white/15 dark:bg-[#1d1d1a]">
        {(["agenda", "week", "month"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            className={clsx(
              "flex-1 rounded-full px-3 py-1.5 text-sm capitalize transition",
              view === mode ? "bg-ink text-paper dark:bg-paper dark:text-ink" : "text-ink/70 dark:text-paper/70"
            )}
            onClick={() => setView(mode)}
          >
            {mode}
          </button>
        ))}
      </div>

      <CalendarSurface
        events={events}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        timezone={timezone}
        view={view}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <EventList
          emptyBody="Pick a date or add a shared plan for a group."
          events={selectedDayEvents}
          timezone={timezone}
        />
        {writableGroup ? (
          <EventForm
            group={writableGroup}
            profile={profile}
            reload={reload}
            selectedDate={selectedDate}
            setMessage={setMessage}
          />
        ) : (
          <EmptyPanel title="No groups yet" body="Create a group before adding calendar plans." />
        )}
      </div>
    </section>
  );
}

function BottomNav({
  activeTab,
  setActiveTab
}: {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}) {
  const items: Array<[AppTab, string, React.ReactNode]> = [
    ["gallery", "Gallery", <ImageIcon key="gallery" size={18} />],
    ["connections", "Connections", <Users key="connections" size={18} />],
    ["groups", "Groups", <Users key="groups" size={18} />],
    ["calendar", "Calendar", <CalendarDays key="calendar" size={18} />],
    ["profile", "Profile", <User key="profile" size={18} />]
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/92 px-3 py-2 backdrop-blur dark:border-white/15 dark:bg-[#1d1d1a]/95">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {items.map(([tab, label, icon]) => (
          <button
            key={tab}
            className={clsx(
              "flex min-w-0 flex-col items-center gap-1 px-1 py-1.5 text-[0.68rem]",
              activeTab === tab ? "text-[#1f73ff]" : "text-ink/55 dark:text-paper/55"
            )}
            onClick={() => setActiveTab(tab)}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function PhotoSection({
  label,
  openPhoto,
  photos,
  sourcePhotos = photos
}: {
  label: string;
  openPhoto: OpenPhoto;
  photos: PhotoItem[];
  sourcePhotos?: PhotoItem[];
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-ink/75 dark:text-paper/75">{label}</h2>
      <PhotoGrid openPhoto={openPhoto} photos={photos} sourcePhotos={sourcePhotos} />
    </section>
  );
}

function PhotoGrid({
  openPhoto,
  photos,
  sourcePhotos = photos
}: {
  openPhoto: OpenPhoto;
  photos: PhotoItem[];
  sourcePhotos?: PhotoItem[];
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {photos.map((photo) => (
        <button
          key={photo.id}
          className="aspect-square overflow-hidden bg-paper"
          onClick={() => openPhoto(photo.id, sourcePhotos)}
        >
          <img alt={photo.title} className={memoryPhotoClass} src={photo.src} />
        </button>
      ))}
    </div>
  );
}

function PhotoStrip({
  openPhoto,
  photos,
  sourcePhotos = photos
}: {
  openPhoto: OpenPhoto;
  photos: PhotoItem[];
  sourcePhotos?: PhotoItem[];
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {photos.map((photo) => (
        <button
          key={photo.id}
          className="h-20 w-20 shrink-0 overflow-hidden bg-paper"
          onClick={() => openPhoto(photo.id, sourcePhotos)}
        >
          <img alt={photo.title} className={memoryPhotoClass} src={photo.src} />
        </button>
      ))}
    </div>
  );
}

function PhotoViewer({
  onDelete,
  photo,
  photos,
  setSelectedPhotoId
}: {
  onDelete: (photo: PhotoItem) => void;
  photo: PhotoItem;
  photos: PhotoItem[];
  setSelectedPhotoId: (id: string | null) => void;
}) {
  const currentIndex = Math.max(0, photos.findIndex((item) => item.id === photo.id));
  const previousPhoto = photos.length > 1 ? photos[(currentIndex - 1 + photos.length) % photos.length] : null;
  const nextPhoto = photos.length > 1 ? photos[(currentIndex + 1) % photos.length] : null;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-ink text-paper">
      <div className="flex items-center justify-between px-4 py-4">
        <button onClick={() => setSelectedPhotoId(null)}>Back</button>
        <p className="text-sm">{currentIndex + 1} / {photos.length}</p>
        <button>...</button>
      </div>
      <div className="relative min-h-0 flex-1">
        <img alt={photo.title} className={memoryPhotoClass} src={photo.src} />
        {previousPhoto ? (
          <button
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-3xl"
            onClick={() => setSelectedPhotoId(previousPhoto.id)}
          >
            ‹
          </button>
        ) : null}
        {nextPhoto ? (
          <button
            aria-label="Next photo"
            className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-3xl"
            onClick={() => setSelectedPhotoId(nextPhoto.id)}
          >
            ›
          </button>
        ) : null}
      </div>
      <div className="rounded-t-2xl bg-white p-4 text-ink">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={photo.owner} src={photo.ownerAvatar} />
            <div>
              <p className="font-semibold">{photo.owner}</p>
              <p className="text-sm text-ink/60">{photo.location}</p>
            </div>
          </div>
          <span />
        </div>
        <p className="text-sm text-ink/60">{photoTime(photo)}</p>
        <p className="mt-3">{photo.caption}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {photo.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-paper px-3 py-1 text-xs">
              #{tag}
            </span>
          ))}
        </div>
        <div className="mt-5 flex justify-end border-t border-line pt-4">
          <button aria-label="Delete photo" className="grid h-10 w-10 place-items-center" onClick={() => onDelete(photo)} type="button">
            <Trash2 size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

function RetroCamera({
  onCapture,
  onClose
}: {
  onCapture: (src: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  useEffect(() => {
    let mounted = true;

    async function openCamera() {
      try {
        setError("");
        streamRef.current?.getTracks().forEach((track) => track.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 960 },
            height: { ideal: 960 }
          }
        });
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setError("Camera access is blocked or unavailable.");
      }
    }

    void openCamera();

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [facingMode]);

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const size = Math.min(video.videoWidth || retroPhotoSize, video.videoHeight || retroPhotoSize);
    const sourceX = Math.max(0, ((video.videoWidth || size) - size) / 2);
    const sourceY = Math.max(0, ((video.videoHeight || size) - size) / 2);
    canvas.width = retroPhotoSize;
    canvas.height = retroPhotoSize;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.filter = "grayscale(1) contrast(1.35) brightness(0.92)";
    context.drawImage(video, sourceX, sourceY, size, size, 0, 0, retroPhotoSize, retroPhotoSize);
    onCapture(canvas.toDataURL("image/jpeg", retroPhotoQuality));
  }

  function switchCamera() {
    setFacingMode((mode) => (mode === "environment" ? "user" : "environment"));
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 py-4 text-sm">
        <button onClick={onClose}>Cancel</button>
        <p className="font-medium tracking-[0.18em]">RETRO</p>
        <button aria-label="Switch camera" className="grid h-10 w-10 place-items-center" onClick={switchCamera} type="button">
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="grid flex-1 place-items-center px-4">
        <div className="relative aspect-square w-full max-w-md overflow-hidden bg-neutral-950">
          {error ? (
            <div className="grid h-full place-items-center px-6 text-center text-sm text-white/70">{error}</div>
          ) : (
            <video
              ref={videoRef}
              className={clsx(
                "h-full w-full object-cover grayscale contrast-125",
                facingMode === "user" && "scale-x-[-1]"
              )}
              muted
              playsInline
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[length:100%_4px] mix-blend-overlay" />
          <div className="pointer-events-none absolute inset-0 border border-white/25" />
        </div>
      </div>

      <div className="grid grid-cols-3 items-center px-8 pb-8">
        <span />
        <button
          aria-label="Take photo"
          className="mx-auto h-20 w-20 rounded-full border-4 border-white bg-white/10 p-1"
          onClick={capture}
          type="button"
        >
          <span className="block h-full w-full rounded-full bg-white" />
        </button>
        <p className="text-right text-xs uppercase tracking-[0.16em] text-white/55">{retroPhotoSize}px</p>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function SharePhotoSheet({
  groups,
  photoUploading,
  src,
  onCancel,
  onShare
}: {
  groups: Group[];
  photoUploading: boolean;
  src: string;
  onCancel: () => void;
  onShare: (target: ShareTarget) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/45 px-3 pb-3 text-ink">
      <section className="mx-auto w-full max-w-md bg-white p-4 shadow-soft dark:bg-[#242420] dark:text-paper">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Share to</h2>
            <p className="text-sm text-ink/55 dark:text-paper/55">Choose where this photo should live.</p>
          </div>
          <button className="text-sm text-ink/60 dark:text-paper/60" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>

        <div className="mb-4 aspect-square w-full overflow-hidden bg-paper dark:bg-[#1d1d1a]">
          <img alt="Captured preview" className={memoryPhotoClass} src={src} />
        </div>

        <div className="grid gap-2">
          <button
            className="flex items-center justify-between border border-line px-3 py-3 text-left dark:border-white/15"
            disabled={photoUploading}
            onClick={() => onShare({ type: "connections" })}
            type="button"
          >
            <span>
              <span className="block font-medium">All connections</span>
              <span className="block text-sm text-ink/55 dark:text-paper/55">Visible to your accepted connections.</span>
            </span>
            <Users size={18} />
          </button>

          {groups.map((group) => (
            <button
              key={group.id}
              className="flex items-center justify-between border border-line px-3 py-3 text-left dark:border-white/15"
              disabled={photoUploading}
              onClick={() => onShare({ type: "group", groupId: group.id })}
              type="button"
            >
              <span>
                <span className="block font-medium capitalize">{group.name}</span>
                <span className="block text-sm text-ink/55 dark:text-paper/55">
                  {group.member_count} {group.member_count === 1 ? "member" : "members"}
                </span>
              </span>
              <Users size={18} />
            </button>
          ))}
        </div>

        {photoUploading ? <p className="mt-3 text-sm text-ink/55 dark:text-paper/55">Saving photo...</p> : null}
      </section>
    </div>
  );
}

function Avatar({
  className,
  name,
  size = "md",
  src
}: {
  className?: string;
  name: string;
  size?: "sm" | "md" | "lg";
  src?: string;
}) {
  const sizeClass = size === "lg" ? "h-20 w-20 text-2xl" : size === "sm" ? "h-8 w-8 text-sm" : "h-10 w-10 text-sm";
  return (
    <div className={clsx("grid shrink-0 place-items-center overflow-hidden rounded-full bg-skysoft font-semibold text-ink", sizeClass, className)}>
      {src ? <img alt="" className="h-full w-full object-cover grayscale contrast-125" src={src} /> : name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function AuthScreen({ message, setMessage }: { message: string; setMessage: (value: string) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");

    const { data, error } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    if (error) setMessage(error.message);
    if (mode === "signup" && !error && !data.session) {
      setMessage("Account created. Check your email to confirm it, then sign in.");
    }
    setBusy(false);
  }

  return (
    <main className="min-h-screen px-4 py-6 text-ink dark:text-paper sm:px-6 lg:px-8">
      <section className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_430px]">
        <AuthVisual />

        <div className="w-full rounded-lg border border-white/70 bg-white/95 p-5 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#242420] sm:p-6">
          <div className="mb-6">
            <div className="mb-4 text-3xl font-semibold leading-none text-ink dark:text-paper">Connection</div>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Share moments with the people who matter.</h1>
            <p className="mt-3 text-sm leading-6 text-ink/65 dark:text-paper/65">
              Keep photos, groups, and shared plans in one quiet place.
            </p>
          </div>
          <form className="flex flex-col gap-3" onSubmit={submit}>
            <Segmented
              value={mode}
              options={[
                ["signup", "Create account"],
                ["signin", "Sign in"]
              ]}
              onChange={(value) => setMode(value as "signin" | "signup")}
            />
            <Field label="Email" type="email" value={email} onChange={setEmail} required />
            <Field label="Password" type="password" value={password} onChange={setPassword} required />
            {message ? (
              <p className="rounded-md border border-rust/20 bg-rust/15 px-3 py-2 text-sm text-rust dark:text-[#ffb49a]">
                {message}
              </p>
            ) : null}
            <button className="mt-2 rounded-full bg-ink px-4 py-3 font-medium text-paper shadow-sm transition hover:-translate-y-0.5 dark:bg-paper dark:text-ink">
              {busy ? "Working..." : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function AuthVisual() {
  return (
    <div className="hidden lg:block">
      <div className="mb-10 max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rust">Connections first</p>
        <h2 className="mt-4 text-6xl font-semibold leading-[0.95] text-ink dark:text-paper">
          Your people, groups, photos, and plans together.
        </h2>
      </div>

      <div className="relative max-w-xl">
        <div className="rounded-lg border border-white/70 bg-white/80 p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#242420]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-ink/45 dark:text-paper/45">Today</p>
              <h3 className="mt-1 text-xl font-semibold">Family gallery</h3>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-skysoft text-ink">
              <Camera size={18} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="aspect-square bg-[radial-gradient(circle_at_35%_35%,#f8f7f4_0,#c7c3ba_32%,#2b2b29_100%)] grayscale"
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 text-sm text-ink/60 dark:text-paper/60">
          <span className="h-px flex-1 bg-line dark:bg-white/15" />
          Photos now, plans when the group needs them
          <span className="h-px flex-1 bg-line dark:bg-white/15" />
        </div>
      </div>
    </div>
  );
}

function ProfileSetup({
  userId,
  message,
  setMessage,
  onComplete
}: {
  userId: string;
  message: string;
  setMessage: (value: string) => void;
  onComplete: () => void;
}) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState(browserTimezone());

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setMessage("");
    const { error } = await supabase.from("profiles").insert({
      id: userId,
      username,
      display_name: displayName,
      preferred_timezone: timezone
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    onComplete();
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10 text-ink dark:text-paper">
      <section className="w-full max-w-md rounded-lg border border-white/70 bg-white/95 p-5 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#242420]">
        <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-skysoft text-ink">
          <Clock3 size={19} />
        </div>
        <h1 className="text-3xl font-semibold leading-tight">Set up your connection profile.</h1>
        <p className="mt-3 text-sm leading-6 text-ink/65 dark:text-paper/65">
          Choose the name people see and the timezone your group calendar should use.
        </p>
        <form className="mt-5 flex flex-col gap-3" onSubmit={submit}>
          <Field label="Username" value={username} onChange={setUsername} required />
          <Field label="Display name" value={displayName} onChange={setDisplayName} required />
          <SelectField label="Preferred timezone" value={timezone} onChange={setTimezone} />
          {message ? <p className="text-sm text-rust dark:text-[#ffb49a]">{message}</p> : null}
          <button className="rounded-full bg-ink px-4 py-3 font-medium text-paper dark:bg-paper dark:text-ink">
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}

function ProfilePanel({ profile }: { profile: Profile }) {
  return (
    <section className="rounded-lg border border-white/70 bg-white/85 p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#242420]">
      <div className="flex items-center gap-3">
        <Avatar name={profile.display_name} src={profile.avatar_url ?? ""} />
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{profile.display_name}</h2>
          <p className="truncate text-sm text-ink/60 dark:text-paper/60">@{profile.username}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-2 text-sm dark:border-white/15 dark:bg-[#1d1d1a]">
        <Clock3 size={16} />
        <span className="truncate">{profile.preferred_timezone}</span>
      </div>
    </section>
  );
}

function AccountMenu({
  darkMode,
  profile,
  reload,
  setDarkMode,
  setMessage
}: {
  darkMode: boolean;
  profile: Profile;
  reload: () => void;
  setDarkMode: (value: boolean) => void;
  setMessage: (value: string) => void;
}) {
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [timezone, setTimezone] = useState(profile.preferred_timezone);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [busy, setBusy] = useState(false);

  async function uploadAvatar(file: File | null) {
    if (!supabase || !file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Choose an image file for your profile picture.");
      return;
    }

    setBusy(true);
    setMessage("");
    let blob: Blob;
    try {
      blob = await imageFileToAvatarBlob(file);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not prepare profile picture.");
      setBusy(false);
      return;
    }

    const path = `${profile.id}/avatar-${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("connection-avatars")
      .upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false
      });

    if (uploadError) {
      setMessage(uploadError.message);
      setBusy(false);
      return;
    }

    const { data } = supabase.storage.from("connection-avatars").getPublicUrl(path);
    const publicUrl = data.publicUrl;
    const { error } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", profile.id);

    if (error) {
      setMessage(error.message);
    } else {
      setAvatarUrl(publicUrl);
      setMessage("Profile picture updated.");
      reload();
    }

    setBusy(false);
  }

  async function updateProfile(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        username,
        display_name: displayName,
        preferred_timezone: timezone,
        avatar_url: avatarUrl || null
      })
      .eq("id", profile.id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Account settings updated.");
      reload();
    }

    setBusy(false);
  }

  return (
    <div className="absolute right-0 top-12 z-20 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-line bg-white p-4 text-left shadow-soft dark:border-white/15 dark:bg-[#242420]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={displayName} src={avatarUrl} />
          <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-rust">Settings</p>
          <p className="text-sm font-semibold">{profile.display_name}</p>
          <p className="text-xs text-ink/55 dark:text-paper/55">@{profile.username}</p>
          </div>
        </div>
        <button
          className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs dark:border-white/15"
          onClick={() => setDarkMode(!darkMode)}
          type="button"
        >
          {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          {darkMode ? "Light" : "Dark"}
        </button>
      </div>

      <form className="grid gap-3" onSubmit={updateProfile}>
        <label className="flex cursor-pointer items-center justify-between rounded-md border border-line px-3 py-3 text-sm dark:border-white/15">
          <span className="flex items-center gap-2">
            <Camera size={16} />
            Profile picture
          </span>
          <input
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(event) => void uploadAvatar(event.target.files?.[0] ?? null)}
            type="file"
          />
          <span className="text-xs text-ink/55 dark:text-paper/55">Upload</span>
        </label>
        <Field label="Username" value={username} onChange={setUsername} required />
        <Field label="Display name" value={displayName} onChange={setDisplayName} required />
        <SelectField label="Timezone" value={timezone} onChange={setTimezone} />
        <button
          className="rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper dark:bg-paper dark:text-ink"
          disabled={busy}
        >
          Save account
        </button>
      </form>

      <button
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-medium dark:border-white/15"
        onClick={() => supabase?.auth.signOut()}
        type="button"
      >
        <LogOut size={15} />
        Sign out
      </button>
    </div>
  );
}

function GroupPanel({
  groups,
  activeGroupId,
  photos,
  setActiveGroupId,
  reload,
  setMessage
}: {
  groups: Group[];
  activeGroupId: string | null;
  photos: PhotoItem[];
  setActiveGroupId: (value: string | null) => void;
  reload: () => void;
  setMessage: (value: string) => void;
}) {
  const [name, setName] = useState("");
  const [inviteGroupId, setInviteGroupId] = useState<string | null>(null);

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !name.trim()) return;
    setMessage("");

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: group, error: groupError } = await supabase.rpc("create_group_with_owner", {
      group_name: name.trim()
    });

    if (groupError) {
      setMessage(groupError.message);
      return;
    }

    setName("");
    setActiveGroupId(group.id);
    reload();
  }

  return (
    <section>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Groups</h1>
        <button aria-label="Create group" className="grid h-10 w-10 place-items-center text-ink dark:text-paper" form="new-group-form">
          <Plus size={22} />
        </button>
      </div>
      <div className="flex flex-col gap-7">
        {groups.map((group) => {
          const groupPhotos = photos.filter((photo) => photo.groupId === group.id);
          const latestPhoto = groupPhotos[0] ?? null;
          return (
            <div key={group.id} className="grid grid-cols-[4rem_minmax(0,1fr)_2.5rem] items-center gap-4">
              <button
                className="contents text-left"
                onClick={() => setActiveGroupId(group.id)}
                type="button"
              >
                <GroupThumb groupId={group.id} photos={photos} />
                <span className="min-w-0">
                  <span className="block truncate text-lg font-semibold capitalize">{group.name}</span>
                  <span className="block truncate text-sm text-ink/55 dark:text-paper/55">
                    {latestPhoto ? `${latestPhoto.owner} • ${photoTime(latestPhoto)}` : "No photos yet"}
                  </span>
                  <span className="block text-sm text-ink/55 dark:text-paper/55">
                    {group.member_count} {group.member_count === 1 ? "member" : "members"}
                  </span>
                </span>
              </button>
              <button
                aria-label={`Invite to ${group.name}`}
                className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white/75 dark:border-white/15 dark:bg-[#1d1d1a]"
                onClick={() => setInviteGroupId((current) => (current === group.id ? null : group.id))}
                type="button"
              >
                <UserPlus size={18} />
              </button>
              {inviteGroupId === group.id ? (
                <div className="col-span-3">
                  <MemberPanel group={group} reload={reload} setMessage={setMessage} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <form id="new-group-form" className="mt-8 flex gap-2" onSubmit={createGroup}>
        <input
          className="min-w-0 flex-1 rounded-full border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
          placeholder="New group"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button aria-label="Create group" className="grid h-10 w-10 place-items-center rounded-full bg-rust text-ink">
          <Plus size={18} />
        </button>
      </form>
    </section>
  );
}

function GroupThumb({ groupId, photos }: { groupId: string; photos: PhotoItem[] }) {
  const image = photos.find((photo) => photo.groupId === groupId)?.src;

  return (
    <span className="block h-16 w-16 overflow-hidden rounded-full bg-paper dark:bg-[#1d1d1a]">
      {image ? <img alt="" className={memoryPhotoClass} src={image} /> : null}
    </span>
  );
}

function GroupGallery({
  group,
  openPhoto,
  photos,
  reload,
  setMessage,
  setActiveGroupId
}: {
  group: Group;
  openPhoto: OpenPhoto;
  photos: PhotoItem[];
  reload: () => void;
  setMessage: (value: string) => void;
  setActiveGroupId: (id: string | null) => void;
}) {
  const owners = [...new Set(photos.map((photo) => photo.ownerId))];
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <section className="flex flex-col gap-7">
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-start">
        <button aria-label="Back to groups" className="grid h-10 w-10 place-items-center" onClick={() => setActiveGroupId(null)}>
          <ArrowLeft size={23} />
        </button>
        <div className="text-center">
          <h1 className="text-lg font-semibold capitalize">{group.name}</h1>
          <p className="text-xs text-ink/55 dark:text-paper/55">
            {group.member_count} {group.member_count === 1 ? "member" : "members"}
          </p>
        </div>
        <button
          aria-label={`Invite to ${group.name}`}
          className="grid h-10 w-10 place-items-center"
          onClick={() => setInviteOpen((value) => !value)}
          type="button"
        >
          <UserPlus size={20} />
        </button>
      </div>

      {inviteOpen ? <MemberPanel group={group} reload={reload} setMessage={setMessage} /> : null}

      {photos.length ? (
        owners.map((owner) => {
          const ownerPhotos = photos.filter((photo) => photo.ownerId === owner);
          const ownerName = ownerPhotos[0]?.owner ?? "Someone";
          return (
            <section key={owner}>
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={ownerName} src={ownerPhotos[0]?.ownerAvatar} />
                <p className="text-sm text-ink/55 dark:text-paper/55">
                  <span className="font-medium text-ink dark:text-paper">{ownerName}</span> {photoTime(ownerPhotos[0])}
                </p>
              </div>
              <PhotoGrid openPhoto={openPhoto} photos={ownerPhotos} sourcePhotos={photos} />
            </section>
          );
        })
      ) : (
        <EmptyPanel title="No group photos yet" body="Photos appear here only when they are shared to this group." />
      )}
    </section>
  );
}

function MemberPanel({
  group,
  reload,
  setMessage
}: {
  group: Group;
  reload: () => void;
  setMessage: (value: string) => void;
}) {
  const [invite, setInvite] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");

  async function inviteMember(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !invite.trim()) return;
    setMessage("");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", invite.trim())
      .maybeSingle();

    if (profileError || !profile) {
      setMessage(profileError?.message ?? "No profile found for that username.");
      return;
    }

    const { error } = await supabase
      .from("group_members")
      .upsert({ group_id: group.id, user_id: profile.id, role });

    if (error) {
      setMessage(error.message);
      return;
    }

    setInvite("");
    reload();
  }

  return (
    <section className="rounded-lg border border-white/70 bg-white/85 p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#242420]">
      <div className="mb-3 flex items-center gap-2">
        <Shield size={18} />
        <h2 className="font-semibold">Invite</h2>
      </div>
      <form className="flex flex-col gap-2" onSubmit={inviteMember}>
        <input
          className="rounded-full border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
          placeholder="Username"
          value={invite}
          onChange={(event) => setInvite(event.target.value)}
          disabled={group.role !== "owner"}
        />
        <div className="flex gap-2">
          <select
            className="min-w-0 flex-1 rounded-full border border-line bg-white px-3 py-2 text-sm text-ink dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
            value={role}
            onChange={(event) => setRole(event.target.value as "editor" | "viewer")}
            disabled={group.role !== "owner"}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button
            aria-label="Invite member"
            disabled={group.role !== "owner"}
            className="grid h-10 w-10 place-items-center rounded-full bg-rust text-ink disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </section>
  );
}

function CalendarSurface({
  view,
  timezone,
  events,
  selectedDate,
  setSelectedDate
}: {
  view: ViewMode;
  timezone: string;
  events: EventItem[];
  selectedDate: string;
  setSelectedDate: (value: string) => void;
}) {
  const today = DateTime.now().setZone(timezone);
  const selected = DateTime.fromISO(selectedDate, { zone: timezone });
  const days =
    view === "week"
      ? Array.from({ length: 7 }, (_, index) => selected.startOf("week").plus({ days: index }))
      : view === "month"
        ? Array.from({ length: selected.daysInMonth ?? 30 }, (_, index) => selected.startOf("month").plus({ days: index }))
        : Array.from({ length: 5 }, (_, index) => today.plus({ days: index }));

  return (
    <section className="rounded-lg border border-white/70 bg-white/85 p-3 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#242420]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-ink/65 dark:text-paper/65">
          <CalendarDays size={16} />
          <span>{timezone}</span>
        </div>
        <button
          aria-label="Return to today"
          className="grid h-9 w-9 place-items-center rounded-full border border-line bg-paper text-ink dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
          onClick={() => setSelectedDate(today.toISODate() ?? selectedDate)}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div
        className={clsx(
          "grid gap-2 overflow-x-auto pb-1",
          view === "month" ? "grid-cols-7" : "grid-cols-[repeat(5,minmax(4.75rem,1fr))] sm:grid-cols-7"
        )}
      >
        {days.map((day) => {
          const dayEvents = events.filter((event) => localDateTime(event, timezone).toISODate() === day.toISODate());
          const isSelected = day.toISODate() === selectedDate;
          return (
            <button
              key={day.toISODate()}
              className={clsx(
                "aspect-square min-h-[4.75rem] rounded-lg border p-2 text-left transition hover:-translate-y-0.5 sm:min-h-20",
                isSelected
                  ? "border-ink bg-ink text-paper shadow-sm dark:border-paper dark:bg-paper dark:text-ink"
                  : "border-line bg-paper/80 text-ink hover:border-moss dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
              )}
              onClick={() => setSelectedDate(day.toISODate() ?? selectedDate)}
            >
              <span className="block text-xs opacity-65">{day.toFormat("ccc")}</span>
              <span className="text-lg font-semibold">{day.day}</span>
              {dayEvents.length ? (
                <span className="mt-1 flex gap-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span key={event.id} className="h-1.5 w-1.5 rounded-full bg-current" />
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function EventList({
  emptyBody,
  events,
  timezone
}: {
  emptyBody: string;
  events: EventItem[];
  timezone: string;
}) {
  if (!events.length) {
    return <EmptyPanel title="No events" body={emptyBody} />;
  }

  return (
    <section className="flex flex-col gap-3">
      {events.map((event) => {
        const local = localDateTime(event, timezone);
        const original = sourceDateTime(event);

        return (
          <article
            key={event.id}
            className="rounded-lg border border-white/70 bg-white/85 p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#242420]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold">{event.title}</h3>
                {event.location ? <p className="text-sm text-ink/60 dark:text-paper/60">{event.location}</p> : null}
              </div>
              <div className="rounded-lg bg-moss px-3 py-2 text-right text-sm font-medium text-white">
                <div>{local.toFormat("h:mm a")}</div>
                <div className="text-xs opacity-80">{local.toFormat("LLL d")}</div>
              </div>
            </div>
            {event.description ? (
              <p className="mt-3 text-sm leading-6 text-ink/70 dark:text-paper/70">{event.description}</p>
            ) : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <TimeChip label="Your time" time={local.toFormat("ccc, LLL d, h:mm a")} zone={timezone} />
              <TimeChip label="Entered as" time={original.toFormat("ccc, LLL d, h:mm a")} zone={event.source_timezone} />
              <TimeChip label="UTC" time={DateTime.fromISO(event.starts_at_utc).toUTC().toFormat("HH:mm")} zone="UTC" />
            </div>
          </article>
        );
      })}
    </section>
  );
}

function EventForm({
  group,
  profile,
  selectedDate,
  reload,
  setMessage
}: {
  group: Group;
  profile: Profile;
  selectedDate: string;
  reload: () => void;
  setMessage: (value: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(selectedDate);
  const [time, setTime] = useState("12:00");
  const [timezone, setTimezone] = useState(profile.preferred_timezone);

  useEffect(() => setDate(selectedDate), [selectedDate]);

  async function createEvent(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !title.trim()) return;
    setMessage("");

    const instant = DateTime.fromISO(`${date}T${time}`, { zone: timezone });
    if (!instant.isValid) {
      setMessage("That date, time, and timezone combination is not valid.");
      return;
    }

    const { error } = await supabase.from("events").insert({
      group_id: group.id,
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      starts_at_utc: instant.toUTC().toISO(),
      source_timezone: timezone,
      creator_id: profile.id
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setTitle("");
    setDescription("");
    setLocation("");
    reload();
  }

  const canEdit = group.role === "owner" || group.role === "editor";

  return (
    <section className="rounded-lg border border-white/70 bg-white/85 p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#242420]">
      <div className="mb-4 flex items-center gap-2">
        <Plus size={18} />
        <h2 className="font-semibold">Add event</h2>
      </div>
      <form className="flex flex-col gap-3" onSubmit={createEvent}>
        <Field label="Title" value={title} onChange={setTitle} required disabled={!canEdit} />
        <Field label="Location" value={location} onChange={setLocation} disabled={!canEdit} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Description
          <textarea
            className="min-h-20 rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal text-ink outline-none focus:border-moss dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={!canEdit}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" type="date" value={date} onChange={setDate} required disabled={!canEdit} />
          <Field label="Time" type="time" value={time} onChange={setTime} required disabled={!canEdit} />
        </div>
        <SelectField label="Timezone entered" value={timezone} onChange={setTimezone} disabled={!canEdit} />
        <button
          disabled={!canEdit}
          className="rounded-full bg-ink px-4 py-3 font-medium text-paper shadow-sm disabled:opacity-45 dark:bg-paper dark:text-ink"
        >
          {canEdit ? "Save event" : "Viewer access"}
        </button>
      </form>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  disabled
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        className="rounded-full border border-line bg-white px-3 py-2 text-sm font-normal text-ink outline-none transition focus:border-moss disabled:opacity-50 dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  disabled
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <select
        className="rounded-full border border-line bg-white px-3 py-2 text-sm font-normal text-ink outline-none transition focus:border-moss disabled:opacity-50 dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {[...new Set([value, browserTimezone(), ...timezones])].map((timezone) => (
          <option key={timezone} value={timezone}>
            {timezone}
          </option>
        ))}
      </select>
    </label>
  );
}

function Segmented({
  value,
  options,
  onChange
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 rounded-full border border-line bg-paper p-1 dark:border-white/15 dark:bg-[#1d1d1a]">
      {options.map(([optionValue, label]) => (
        <button
          type="button"
          key={optionValue}
          className={clsx(
            "rounded-full px-3 py-2 text-sm font-medium transition",
            value === optionValue
              ? "bg-ink text-paper dark:bg-paper dark:text-ink"
              : "text-ink/70 dark:text-paper/70"
          )}
          onClick={() => onChange(optionValue)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function TimeChip({ label, time, zone }: { label: string; time: string; zone: string }) {
  return (
    <div className="rounded-lg border border-line/70 bg-paper px-3 py-2 text-sm dark:border-white/10 dark:bg-[#1d1d1a]">
      <p className="text-xs uppercase tracking-[0.14em] text-ink/45 dark:text-paper/45">{label}</p>
      <p className="mt-1 font-medium">{time}</p>
      <p className="truncate text-xs text-ink/55 dark:text-paper/55">{zone}</p>
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-lg border border-dashed border-rust/40 bg-white/70 p-6 text-center shadow-sm backdrop-blur dark:border-rust/40 dark:bg-[#242420]">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-paper text-rust dark:bg-[#1d1d1a]">
        <Check size={18} />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">{body}</p>
    </section>
  );
}

function ConfigScreen() {
  return (
    <main className="min-h-screen px-4 py-6 text-ink dark:text-paper sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[390px_minmax(0,1fr)]">
        <div className="flex flex-col justify-between rounded-lg border border-line bg-white/95 p-5 shadow-soft dark:border-white/15 dark:bg-[#242420]">
          <div>
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-md bg-skysoft text-ink dark:bg-paper dark:text-ink">
              <Camera size={24} />
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-moss dark:text-skysoft">
              Connection app setup
            </p>
            <h1 className="mt-2 text-3xl font-semibold">A private place for people, groups, photos, and plans.</h1>
            <p className="mt-3 text-sm leading-6 text-ink/65 dark:text-paper/65">
              Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`, then run
              `supabase/schema.sql` inside your Supabase project.
            </p>
          </div>
          <div className="mt-6 grid gap-2 text-sm">
            <SetupStep label="Auth" text="Email, username, display name, timezone" />
            <SetupStep label="Photos" text="Shared to people or groups" />
            <SetupStep label="Calendar" text="Overall view with group filter" />
          </div>
        </div>
        <BridgePreview />
      </section>
    </main>
  );
}

function SetupStep({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-paper px-3 py-2 dark:bg-[#1d1d1a]">
      <span className="grid h-7 w-7 place-items-center rounded bg-skysoft text-xs font-semibold text-ink">
        {label.slice(0, 1)}
      </span>
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-ink/55 dark:text-paper/55">{text}</p>
      </div>
    </div>
  );
}

function BridgePreview() {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-[#fffaf0]/95 shadow-soft dark:border-white/15 dark:bg-[#242420]">
      <div className="border-b border-line bg-white/80 px-4 py-3 dark:border-white/15 dark:bg-white/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-rust">Family</p>
            <h2 className="text-xl font-semibold">Shared this week</h2>
          </div>
          <div className="rounded-md bg-skysoft px-3 py-2 text-right text-ink dark:bg-paper dark:text-ink">
            <p className="text-xs opacity-70">photos</p>
            <p className="font-semibold">128</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-[1fr_220px]">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }, (_, index) => (
            <div
              key={index}
              className="aspect-square bg-[radial-gradient(circle_at_35%_35%,#f8f7f4_0,#c7c3ba_32%,#2b2b29_100%)] grayscale dark:bg-[#1d1d1a]"
            />
          ))}
        </div>

        <div className="flex flex-col justify-between rounded-lg bg-skysoft p-4 text-ink dark:bg-paper dark:text-ink">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] opacity-65">Group tools</p>
            <p className="mt-3 text-2xl font-semibold leading-tight">Photos lead. Calendar stays ready.</p>
          </div>
          <div className="mt-6 grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Check size={16} />
              People view
            </div>
            <div className="flex items-center gap-2">
              <Check size={16} />
              Group gallery
            </div>
            <div className="flex items-center gap-2">
              <Check size={16} />
              Calendar filter
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ShellStatus({ label }: { label: string }) {
  return (
    <main className="grid min-h-screen place-items-center text-ink dark:text-paper">
      <div className="flex items-center gap-3 text-sm">
        <RefreshCw className="animate-spin" size={18} />
        {label}
      </div>
    </main>
  );
}
