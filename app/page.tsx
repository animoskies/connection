"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Camera,
  Check,
  Clock3,
  Copy,
  Download,
  Image as ImageIcon,
  Info,
  LogOut,
  MoreHorizontal,
  Moon,
  Plus,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Shield,
  Sun,
  Trash2,
  User,
  UserPlus,
  Users,
  X
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
  owner_name: string;
  owner_username: string;
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

type GroupInvite = {
  id: string;
  token: string;
  groupId: string;
  groupName: string;
  role: "owner" | "editor" | "viewer";
  inviterName: string;
  createdAt: string;
};

type GroupNotification = {
  id: string;
  groupId: string;
  groupName: string;
  actorName: string;
  message: string;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

type ConnectionRelationship = "none" | "pending_sent" | "pending_received" | "connected" | "self";

type ConnectionProfile = {
  id: string;
  username: string;
  displayName: string;
  preferredTimezone: string;
  avatarUrl: string;
  relationship: ConnectionRelationship;
  connectedAt?: string;
};

type ConnectionRequest = {
  requesterId: string;
  username: string;
  displayName: string;
  preferredTimezone: string;
  avatarUrl: string;
  createdAt: string;
};

type InvitePreview = {
  token: string;
  groupId: string;
  groupName: string;
  role: "owner" | "editor" | "viewer";
  inviterName: string;
};

type PendingGroupInviteRow = {
  id: string;
  token: string;
  group_id: string;
  group_name: string | null;
  role: "owner" | "editor" | "viewer";
  inviter_name: string | null;
  created_at: string;
};

type GroupNotificationRow = {
  id: string;
  group_id: string;
  group_name: string | null;
  actor_name: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

type ConnectionProfileRow = {
  id: string;
  username: string;
  display_name: string;
  preferred_timezone: string;
  avatar_url: string | null;
  relationship: ConnectionRelationship;
  connected_at?: string;
};

type ConnectionRequestRow = {
  requester_id: string;
  username: string;
  display_name: string;
  preferred_timezone: string;
  avatar_url: string | null;
  created_at: string;
};

const supabase = hasSupabaseConfig ? createSupabaseClient() : null;
const configuredAppUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://connection-amber.vercel.app";
const memoryPhotoClass = "h-full w-full object-cover";
const nativePhotoMaxSize = 1280;
const nativePhotoQuality = 0.72;
const avatarPhotoSize = 320;
type OpenPhoto = (id: string, photos: PhotoItem[]) => void;
type WorkspaceReload = () => void | Promise<void>;
type ShareTarget =
  | { type: "connections" }
  | { type: "group"; groupId: string };

function isTransientMessage(message: string) {
  return [
    "Latest photos, groups, invites, notifications, and calendar loaded.",
    "Photo saved to group successfully.",
    "Photo saved to connections successfully.",
    "Photo deleted successfully.",
    "Connection request sent.",
    "Connection request accepted.",
    "Connection request declined.",
    "Connection removed.",
    "Group saved successfully.",
    "Group saved successfully. Invites sent.",
    "Group updated successfully.",
    "Group deleted successfully.",
    "Calendar event added successfully.",
    "Calendar event updated successfully.",
    "Calendar event deleted successfully.",
    "Profile picture updated.",
    "Account settings updated.",
    "Dark mode on.",
    "Dark mode off.",
    "Invite link copied.",
    "Invite declined."
  ].includes(message) ||
    message.startsWith("Invite sent to ") ||
    message.startsWith("Joined ") ||
    message.startsWith("Only admin ") ||
    message.startsWith("Connect with ");
}

function mapConnectionProfile(row: ConnectionProfileRow): ConnectionProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    preferredTimezone: row.preferred_timezone,
    avatarUrl: row.avatar_url ?? "",
    relationship: row.relationship,
    connectedAt: row.connected_at
  };
}

function mapConnectionRequest(row: ConnectionRequestRow): ConnectionRequest {
  return {
    requesterId: row.requester_id,
    username: row.username,
    displayName: row.display_name,
    preferredTimezone: row.preferred_timezone,
    avatarUrl: row.avatar_url ?? "",
    createdAt: row.created_at
  };
}

function mapGroupNotification(row: GroupNotificationRow): GroupNotification {
  return {
    id: row.id,
    groupId: row.group_id,
    groupName: row.group_name ?? "Group",
    actorName: row.actor_name ?? "Someone",
    message: row.message,
    metadata: row.metadata ?? {},
    readAt: row.read_at,
    createdAt: row.created_at
  };
}

function appUrl(path = "/") {
  const base = configuredAppUrl || (typeof window !== "undefined" ? window.location.origin : "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function icsEscape(value = "") {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function icsDate(value: string) {
  return DateTime.fromISO(value, { zone: "utc" }).toFormat("yyyyLLdd'T'HHmmss'Z'");
}

function downloadEventIcs(event: EventItem) {
  const start = DateTime.fromISO(event.starts_at_utc, { zone: "utc" });
  const end = start.plus({ hours: 1 });
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Connection//Group Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@connection`,
    `DTSTAMP:${DateTime.utc().toFormat("yyyyLLdd'T'HHmmss'Z'")}`,
    `DTSTART:${icsDate(event.starts_at_utc)}`,
    `DTEND:${end.toFormat("yyyyLLdd'T'HHmmss'Z'")}`,
    `SUMMARY:${icsEscape(event.title)}`,
    event.description ? `DESCRIPTION:${icsEscape(event.description)}` : "",
    event.location ? `LOCATION:${icsEscape(event.location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean).join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.title.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "event"}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function localDateTime(event: EventItem, timezone: string) {
  return DateTime.fromISO(event.starts_at_utc, { zone: "utc" }).setZone(timezone);
}

function sourceDateTime(event: EventItem) {
  return DateTime.fromISO(event.starts_at_utc, { zone: "utc" }).setZone(event.source_timezone);
}

function notificationTime(value: string) {
  const date = DateTime.fromISO(value);
  if (!date.isValid) return "Recently";
  const now = DateTime.now();
  if (now.diff(date, "minutes").minutes < 1) return "Just now";
  if (now.diff(date, "days").days < 1) return date.toRelative({ base: now }) ?? date.toFormat("h:mm a");
  return date.toFormat("LLL d, h:mm a");
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

function eventChangeSummary(previousEvent: EventItem | null, nextEvent: {
  title: string;
  description: string | null;
  location: string | null;
  starts_at_utc: string | null;
  source_timezone: string;
}) {
  if (!previousEvent) return "New event";
  const changes: string[] = [];

  if (previousEvent.title !== nextEvent.title) {
    changes.push(`Title: ${previousEvent.title} -> ${nextEvent.title}`);
  }

  if ((previousEvent.location ?? "") !== (nextEvent.location ?? "")) {
    changes.push(`Location: ${previousEvent.location || "None"} -> ${nextEvent.location || "None"}`);
  }

  if ((previousEvent.description ?? "") !== (nextEvent.description ?? "")) {
    changes.push("Description changed");
  }

  if (previousEvent.starts_at_utc !== nextEvent.starts_at_utc || previousEvent.source_timezone !== nextEvent.source_timezone) {
    const before = sourceDateTime(previousEvent).toFormat("LLL d, h:mm a");
    const after = nextEvent.starts_at_utc
      ? DateTime.fromISO(nextEvent.starts_at_utc, { zone: "utc" }).setZone(nextEvent.source_timezone).toFormat("LLL d, h:mm a")
      : "Updated time";
    changes.push(`Date/time: ${before} -> ${after}`);
  }

  return changes.length ? changes.join(" • ") : "Details refreshed";
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

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(input);
    return copied;
  }
}

function imageFileToPhotoDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, nativePhotoMaxSize / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Could not prepare photo."));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", nativePhotoQuality));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo."));
    };
    image.src = url;
  });
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
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([]);
  const [groupNotifications, setGroupNotifications] = useState<GroupNotification[]>([]);
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);
  const [connections, setConnections] = useState<ConnectionProfile[]>([]);
  const [connectionSearchResults, setConnectionSearchResults] = useState<ConnectionProfile[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("connections");
  const [calendarGroupId, setCalendarGroupId] = useState("all");
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [viewerPhotoIds, setViewerPhotoIds] = useState<string[]>([]);
  const [pendingCaptureSrc, setPendingCaptureSrc] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [view, setView] = useState<ViewMode>("agenda");
  const [selectedDate, setSelectedDate] = useState(DateTime.now().toISODate());
  const [calendarEventToOpenId, setCalendarEventToOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [message, setMessage] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<InvitePreview | null>(null);
  const notificationAreaRef = useRef<HTMLDivElement | null>(null);
  const pullStartRef = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const setKeyboardState = () => {
      const keyboardOpen = viewport.height < window.innerHeight - 120;
      document.body.classList.toggle("keyboard-open", keyboardOpen);
    };

    setKeyboardState();
    viewport.addEventListener("resize", setKeyboardState);
    viewport.addEventListener("scroll", setKeyboardState);

    return () => {
      viewport.removeEventListener("resize", setKeyboardState);
      viewport.removeEventListener("scroll", setKeyboardState);
      document.body.classList.remove("keyboard-open");
    };
  }, []);

  useEffect(() => {
    if (!sessionUserId || !message || !isTransientMessage(message)) return;
    const timeout = window.setTimeout(() => {
      setMessage((currentMessage) => (currentMessage === message ? "" : currentMessage));
    }, 1800);
    return () => window.clearTimeout(timeout);
  }, [message, sessionUserId]);

  useEffect(() => {
    if (!notificationsOpen) return;
    setNotificationsOpen(false);
  }, [activeGroupId, activeTab, pendingCaptureSrc, selectedConnectionId, selectedPhotoId]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && notificationAreaRef.current?.contains(target)) return;
      setNotificationsOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [notificationsOpen]);

  useEffect(() => {
    if (!sessionUserId || !profile) return;

    const loadLightweightNotifications = () => {
      void loadGroupNotifications();
      void loadGroupInvites(sessionUserId);
      void loadConnectionRequests();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadLightweightNotifications();
    };

    const interval = window.setInterval(loadLightweightNotifications, 10000);
    window.addEventListener("focus", loadLightweightNotifications);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", loadLightweightNotifications);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [sessionUserId, profile?.id]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().catch(() => undefined);
        });
      });
      caches?.keys?.().then((keys) => {
        keys.forEach((key) => {
          caches.delete(key).catch(() => undefined);
        });
      });
      return;
    }

    if (process.env.NODE_ENV === "production") {
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
    const inviteToken = new URLSearchParams(window.location.search).get("invite");
    if (!inviteToken) return;
    localStorage.setItem("connection-pending-invite", inviteToken);
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    async function syncSession() {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { data, error } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        window.history.replaceState({}, "", window.location.pathname);

        if (error) {
          setMessage(error.message);
          setSessionUserId(null);
        } else {
          setSessionUserId(data.session?.user.id ?? null);
        }
        setLoading(false);
        return;
      }

      const { data } = await client.auth.getSession();
      setSessionUserId(data.session?.user.id ?? null);
      setLoading(false);
    }

    void syncSession();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionUserId) {
      setProfile(null);
      setGroups([]);
      setGroupInvites([]);
      setGroupNotifications([]);
      setConnectionRequests([]);
      setConnections([]);
      setConnectionSearchResults([]);
      setSelectedConnectionId(null);
      setEvents([]);
      setPhotos([]);
      return;
    }

    void loadWorkspace(sessionUserId);
  }, [sessionUserId]);

  useEffect(() => {
    if (!sessionUserId || !profile) return;
    void preparePendingInvitePrompt();
  }, [sessionUserId, profile]);

  async function loadWorkspace(userId = sessionUserId, options: { clearMessage?: boolean } = {}) {
    if (!supabase || !userId) return;
    const { clearMessage = true } = options;
    setLoading(true);
    if (clearMessage) setMessage("");

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) setMessage(profileError.message);
    setProfile(profileData);

    const { data: membershipData, error: membershipError } = await supabase
      .from("group_members")
      .select("role, groups(id, name, owner_id, profiles!groups_owner_id_fkey(username, display_name))")
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
        const ownerProfile = group
          ? Array.isArray(group.profiles)
            ? group.profiles[0]
            : group.profiles
          : null;
        return group
          ? [
              {
                id: group.id,
                name: group.name,
                owner_id: group.owner_id,
                owner_name: ownerProfile?.display_name ?? ownerProfile?.username ?? "Admin",
                owner_username: ownerProfile?.username ?? "admin",
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
    await loadGroupInvites(userId);
    await loadGroupNotifications();
    await loadConnections();
    await loadConnectionRequests();

    setLoading(false);
  }

  async function refreshWorkspace() {
    if (!sessionUserId || refreshing) return;
    setRefreshing(true);
    try {
      await loadWorkspace(sessionUserId, { clearMessage: false });
      setMessage("Latest photos, groups, invites, notifications, and calendar loaded.");
    } finally {
      setRefreshing(false);
    }
  }

  async function loadGroupInvites(userId = sessionUserId) {
    if (!supabase || !userId) return;

    const { data, error } = await supabase.rpc("pending_group_invites");

    if (error) {
      setMessage(error.message);
      return;
    }

    setGroupInvites(
      ((data ?? []) as PendingGroupInviteRow[]).map((invite) => {
        return {
          id: invite.id,
          token: invite.token,
          groupId: invite.group_id,
          groupName: invite.group_name ?? "Group",
          role: invite.role,
          inviterName: invite.inviter_name ?? "Someone",
          createdAt: invite.created_at
        } as GroupInvite;
      })
    );
  }

  async function loadGroupNotifications() {
    if (!supabase) return;

    const { data, error } = await supabase.rpc("pending_group_notifications");

    if (error) {
      setMessage(error.message);
      return;
    }

    setGroupNotifications(((data ?? []) as GroupNotificationRow[]).map(mapGroupNotification));
  }

  async function notifyGroupMembers(groupId: string, notificationMessage: string, metadata: Record<string, unknown> = {}) {
    if (!supabase) return;

    const { error } = await supabase.rpc("notify_group_members", {
      target_group_id: groupId,
      notification_message: notificationMessage,
      notification_metadata: metadata
    });

    if (error) {
      setMessage(error.message);
    }
  }

  async function markGroupNotificationRead(notificationId: string) {
    if (!supabase) return;

    const { error } = await supabase.rpc("mark_group_notification_read", {
      notification_id: notificationId
    });

    if (error) {
      setMessage(`Failed to update notification. ${error.message}`);
      return;
    }

    setGroupNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, readAt: new Date().toISOString() } : notification
      )
    );
  }

  async function openGroupNotification(notification: GroupNotification) {
    if (!notification.readAt) {
      await markGroupNotificationRead(notification.id);
    }

    const type = notification.metadata.type;
    const action = notification.metadata.action;
    const eventId = typeof notification.metadata.eventId === "string" ? notification.metadata.eventId : null;
    const eventDate = typeof notification.metadata.eventDate === "string" ? notification.metadata.eventDate : null;
    const groupId = typeof notification.metadata.groupId === "string" ? notification.metadata.groupId : notification.groupId;

    setNotificationsOpen(false);

    if (type === "calendar_event") {
      setCalendarGroupId(groupId);
      if (eventDate) setSelectedDate(eventDate);
      if (eventId && action !== "deleted") setCalendarEventToOpenId(eventId);
      setActiveTab("calendar");
      return;
    }

    setActiveGroupId(notification.groupId);
    setActiveTab("groups");
  }

  async function loadConnections() {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("my_connections");

    if (error) {
      setMessage(error.message);
      return;
    }

    const loadedConnections = ((data ?? []) as ConnectionProfileRow[]).map(mapConnectionProfile);
    setConnections(loadedConnections);
    setSelectedConnectionId((currentId) =>
      currentId && loadedConnections.some((connection) => connection.id === currentId) ? currentId : null
    );
  }

  async function loadConnectionRequests() {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("pending_connection_requests");

    if (error) {
      setMessage(error.message);
      return;
    }

    setConnectionRequests(((data ?? []) as ConnectionRequestRow[]).map(mapConnectionRequest));
  }

  async function searchConnections(query: string) {
    if (!supabase || query.trim().length < 2) {
      setConnectionSearchResults([]);
      return;
    }

    const { data, error } = await supabase.rpc("search_profiles", {
      search_text: query
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setConnectionSearchResults(((data ?? []) as ConnectionProfileRow[]).map(mapConnectionProfile));
  }

  async function sendConnectionRequest(targetUserId: string) {
    if (!supabase) return;
    setMessage("");
    const { error } = await supabase.rpc("send_connection_request", {
      target_user_id: targetUserId
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setConnectionSearchResults((current) =>
      current.map((result) =>
        result.id === targetUserId ? { ...result, relationship: "pending_sent" } : result
      )
    );
    await loadConnections();
    await loadConnectionRequests();
    await loadPhotos();
    setMessage("Connection request sent.");
  }

  async function acceptConnectionRequest(requesterUserId: string) {
    if (!supabase) return;
    setMessage("");
    const { error } = await supabase.rpc("accept_connection_request", {
      requester_user_id: requesterUserId
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setNotificationsOpen(false);
    await loadConnections();
    await loadConnectionRequests();
    await loadPhotos();
    setMessage("Connection request accepted.");
  }

  async function declineConnectionRequest(requesterUserId: string) {
    if (!supabase) return;
    setMessage("");
    const { error } = await supabase.rpc("decline_connection_request", {
      requester_user_id: requesterUserId
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setConnectionRequests((current) => current.filter((request) => request.requesterId !== requesterUserId));
    setNotificationsOpen(false);
    setMessage("Connection request declined.");
  }

  async function removeConnection(targetUserId: string) {
    if (!supabase) return;
    setMessage("");
    const { error } = await supabase.rpc("remove_connection", {
      target_user_id: targetUserId
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setSelectedConnectionId(null);
    await loadConnections();
    await loadPhotos();
    setMessage("Connection removed.");
  }

  async function preparePendingInvitePrompt() {
    if (!supabase) return;
    const inviteToken = localStorage.getItem("connection-pending-invite");
    if (!inviteToken || pendingInvite?.token === inviteToken) return;

    const { data, error } = await supabase.rpc("group_invite_details", {
      invite_token: inviteToken
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const invite = Array.isArray(data) ? data[0] : null;
    if (!invite) {
      localStorage.removeItem("connection-pending-invite");
      setMessage("That invite link is no longer available.");
      return;
    }

    setPendingInvite({
      token: inviteToken,
      groupId: invite.group_id,
      groupName: invite.group_name,
      role: invite.role,
      inviterName: invite.inviter_name ?? "Someone"
    });
  }

  async function acceptInvite(token: string) {
    if (!supabase) return;
    setMessage("");
    const { data, error } = await supabase.rpc("accept_group_invite", {
      invite_token: token
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    localStorage.removeItem("connection-pending-invite");
    setPendingInvite(null);
    setNotificationsOpen(false);
    setMessage(`Joined ${data?.name ?? "group"}.`);
    await loadWorkspace();
  }

  async function declineInvite(token: string) {
    if (!supabase) return;
    setMessage("");
    const { error } = await supabase.rpc("decline_group_invite", {
      invite_token: token
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    localStorage.removeItem("connection-pending-invite");
    setPendingInvite(null);
    setGroupInvites((current) => current.filter((invite) => invite.token !== token));
    setNotificationsOpen(false);
    setMessage("Invite declined.");
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

  function openPhotoOwner(photo: PhotoItem) {
    if (profile && photo.ownerId === profile.id) {
      setSelectedPhotoId(null);
      setActiveTab("profile");
      return;
    }

    if (connections.some((connection) => connection.id === photo.ownerId)) {
      setSelectedPhotoId(null);
      setSelectedConnectionId(photo.ownerId);
      setActiveTab("connections");
    }
  }

  function openPersonProfile(profileId: string, displayName = "this person") {
    if (profile && profileId === profile.id) {
      setActiveTab("profile");
      return;
    }

    if (connections.some((connection) => connection.id === profileId)) {
      setSelectedConnectionId(profileId);
      setActiveTab("connections");
      return;
    }

    setMessage(`Connect with ${displayName} to see their feed.`);
  }

  async function handleNativePhoto(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Choose a photo from your camera or library.");
      return;
    }

    setMessage("");
    try {
      const src = await imageFileToPhotoDataUrl(file);
      setPendingCaptureSrc(src);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not prepare photo.");
    }
  }

  async function uploadCapturedPhoto(src: string, target: ShareTarget, caption = "") {
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
      setMessage(`Failed to save photo. ${uploadError.message}`);
      setPhotoUploading(false);
      return;
    }

    const headers = await authHeaders();
    if (!headers) {
      setPhotoUploading(false);
      return;
    }

    const groupId = target.type === "group" ? target.groupId : null;

    const response = await fetch("/api/photos", {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: "Untitled memory",
        caption: caption.trim(),
        location: "",
        groupId,
        shareScope: target.type === "group" ? "group" : "connections",
        storagePath,
        takenAt: new Date().toISOString(),
        tags: []
      })
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(`Failed to save photo. ${payload.error ?? "Please try again."}`);
      await supabase.storage.from("connection-photos").remove([storagePath]);
      setPhotoUploading(false);
      return;
    }

    setPhotos((currentPhotos) => [payload.photo, ...currentPhotos]);
    setViewerPhotoIds([payload.photo.id]);
    if (target.type === "group") {
      setActiveGroupId(target.groupId);
      setActiveTab("groups");
    } else {
      setSelectedConnectionId(null);
      setActiveTab("connections");
    }
    setSelectedPhotoId(payload.photo.id);
    setPendingCaptureSrc(null);
    if (target.type === "group") {
      const group = groups.find((item) => item.id === target.groupId);
      await notifyGroupMembers(target.groupId, `${profile.display_name} posted a photo${group ? ` in ${group.name}` : ""}.`);
    }
    setMessage(target.type === "group" ? "Photo saved to group successfully." : "Photo saved to connections successfully.");
    setPhotoUploading(false);
  }

  async function deletePhoto(photo: PhotoItem) {
    const confirmed = window.confirm("Delete this photo?");
    if (!confirmed) return;

    const headers = await authHeaders();
    if (!headers) return;

    const response = await fetch(`/api/photos/${photo.id}`, {
      method: "DELETE",
      headers
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(`Failed to delete photo. ${payload.error ?? "Please try again."}`);
      return;
    }

    setPhotos((currentPhotos) => currentPhotos.filter((item) => item.id !== photo.id));
    const remainingViewerIds = viewerPhotoIds.filter((id) => id !== photo.id);
    setViewerPhotoIds(remainingViewerIds);
    setSelectedPhotoId(remainingViewerIds[0] ?? null);
    setMessage("Photo deleted successfully.");
  }

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? null;
  const allPhotos = photos;
  const myPhotos = profile ? photos.filter((photo) => photo.ownerId === profile.id) : [];
  const myPublicPhotos = myPhotos.filter((photo) => photo.groupId === null && photo.shareScope === "connections");
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
  const unreadGroupNotifications = groupNotifications.filter((notification) => !notification.readAt);
  const notificationCount = groupInvites.length + connectionRequests.length + unreadGroupNotifications.length;
  const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId) ?? null;
  const selectedDayEvents = useMemo(() => {
    return calendarEvents.filter((event) => localDateTime(event, preferredTimezone).toISODate() === selectedDate);
  }, [calendarEvents, preferredTimezone, selectedDate]);
  const pullProgress = Math.min(1, pullDistance / 72);
  const pullRefreshLabel = refreshing ? "Refreshing" : pullProgress >= 1 ? "Release to refresh" : "Pull to refresh";

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
    <main
      className="min-h-screen px-4 pb-24 pt-5 text-ink dark:text-paper sm:px-6 lg:px-8"
      onTouchStart={(event) => {
        if (window.scrollY === 0 && !selectedPhoto && !pendingCaptureSrc && !refreshing) {
          pullStartRef.current = event.touches[0]?.clientY ?? null;
        }
      }}
      onTouchMove={(event) => {
        if (pullStartRef.current === null) return;
        const currentY = event.touches[0]?.clientY;
        if (typeof currentY !== "number") return;
        const distance = currentY - pullStartRef.current;
        if (distance <= 0 || window.scrollY > 0) {
          setPullDistance(0);
          return;
        }
        setPullDistance(Math.min(96, distance * 0.55));
      }}
      onTouchEnd={() => {
        if (pullStartRef.current === null) return;
        const shouldRefresh = pullDistance >= 72;
        pullStartRef.current = null;
        setPullDistance(0);
        if (shouldRefresh) void refreshWorkspace();
      }}
      onTouchCancel={() => {
        pullStartRef.current = null;
        setPullDistance(0);
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        {(pullDistance > 0 || refreshing) && !selectedPhoto && !pendingCaptureSrc ? (
          <div
            className="pointer-events-none -mb-3 flex items-center justify-center gap-2 text-xs font-medium text-ink/50 transition dark:text-paper/50"
            style={{ height: refreshing ? 28 : Math.max(18, pullDistance) }}
          >
            <RefreshCw className={clsx(refreshing && "animate-spin")} size={14} />
            <span>{pullRefreshLabel}</span>
          </div>
        ) : null}
        <header className="sticky top-0 z-20 grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 py-3">
          <label
            aria-label="Open camera"
            className="grid h-11 w-11 cursor-pointer place-items-center text-ink transition hover:-translate-y-0.5 dark:text-paper"
          >
            <Plus size={30} strokeWidth={1.8} />
            <input
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                void handleNativePhoto(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
              type="file"
            />
          </label>
          <ConnectionLogo compact className="justify-self-center" />
          <div ref={notificationAreaRef} className="relative flex items-center justify-end gap-2">
            <button
              aria-label="Refresh latest data"
              className="grid h-11 w-11 place-items-center text-ink transition hover:-translate-y-0.5 dark:text-paper"
              disabled={refreshing}
              onClick={() => void refreshWorkspace()}
              type="button"
            >
              <RefreshCw className={clsx(refreshing && "animate-spin")} size={18} />
            </button>
            <button
              aria-label="Notifications"
              className="relative grid h-11 w-11 place-items-center text-ink transition hover:-translate-y-0.5 dark:text-paper"
              onClick={() => {
                setAccountOpen(false);
                if (!notificationsOpen) {
                  void loadGroupNotifications();
                  void loadGroupInvites(sessionUserId);
                  void loadConnectionRequests();
                }
                setNotificationsOpen((value) => !value);
              }}
              type="button"
            >
              <Bell size={18} />
              {notificationCount ? (
                <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rust" />
              ) : null}
            </button>
            {notificationsOpen ? (
              <NotificationCenter
                connectionRequests={connectionRequests}
                groupNotifications={groupNotifications}
                invites={groupInvites}
                onAcceptConnection={(requesterId) => void acceptConnectionRequest(requesterId)}
                onAcceptGroup={(token) => void acceptInvite(token)}
                onDeclineConnection={(requesterId) => void declineConnectionRequest(requesterId)}
                onDeclineGroup={(token) => void declineInvite(token)}
                onOpenGroupNotification={(notification) => void openGroupNotification(notification)}
              />
            ) : null}
            <button
              aria-label="Account settings"
              className="grid h-11 w-11 place-items-center rounded-full transition hover:-translate-y-0.5"
              onClick={() => {
                setNotificationsOpen(false);
                setAccountOpen((value) => !value);
              }}
            >
              <Avatar name={profile.display_name} src={profile.avatar_url ?? ""} size="sm" className="h-11 w-11" />
            </button>
            {accountOpen ? (
              <AccountMenu
                darkMode={darkMode}
                onClose={() => setAccountOpen(false)}
                profile={profile}
                reload={() => loadWorkspace()}
                setDarkMode={setDarkMode}
                setMessage={setMessage}
              />
            ) : null}
          </div>
        </header>

        {message ? (
          <div className="fixed left-1/2 top-5 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-full border border-line bg-white px-4 py-3 text-center text-sm font-medium text-ink shadow-soft dark:border-white/15 dark:bg-[#2b2a25] dark:text-paper">
            {message}
          </div>
        ) : null}

        {activeTab === "gallery" ? (
          <GalleryView openPhoto={openPhoto} photos={myPhotos} />
        ) : null}

        {activeTab === "connections" ? (
          <ConnectionsView
            openPhoto={openPhoto}
            photos={connectionPhotos}
            searchResults={connectionSearchResults}
            selectedConnection={selectedConnection}
            onBack={() => setSelectedConnectionId(null)}
            onOpenProfile={setSelectedConnectionId}
            onRemoveConnection={(profileId) => void removeConnection(profileId)}
            onSearch={(query) => void searchConnections(query)}
            onSendRequest={(profileId) => void sendConnectionRequest(profileId)}
          />
        ) : null}

        {activeTab === "groups" ? (
          <GroupsView
            activeGroup={activeGroup}
            activeGroupId={activeGroupId}
            groups={groups}
            notifyGroupMembers={notifyGroupMembers}
            onOpenGroupCalendar={(groupId) => {
              setActiveGroupId(null);
              setCalendarGroupId(groupId);
              setActiveTab("calendar");
            }}
            onOpenProfile={openPersonProfile}
            photos={allPhotos}
            profile={profile}
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
            eventToOpenId={calendarEventToOpenId}
            events={calendarEvents}
            groups={groups}
            profile={profile}
            reload={() => loadWorkspace()}
            selectedDayEvents={selectedDayEvents}
            selectedDate={selectedDate}
            setCalendarGroupId={setCalendarGroupId}
            setEventToOpenId={setCalendarEventToOpenId}
            setMessage={setMessage}
            setSelectedDate={setSelectedDate}
            setView={setView}
            notifyGroupMembers={notifyGroupMembers}
            timezone={preferredTimezone}
            view={view}
          />
        ) : null}

        {activeTab === "profile" ? (
          <ProfileView
            connections={connections}
            groups={groups}
            openPhoto={openPhoto}
            photos={myPublicPhotos}
            profile={profile}
            onOpenConnection={(profileId) => {
              setSelectedConnectionId(profileId);
              setActiveTab("connections");
            }}
            onOpenGroups={() => setActiveTab("groups")}
          />
        ) : null}
      </div>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {selectedPhoto ? (
        <PhotoViewer
          canOpenOwner={Boolean(
            profile &&
              (selectedPhoto.ownerId === profile.id ||
                connections.some((connection) => connection.id === selectedPhoto.ownerId))
          )}
          canDelete={Boolean(profile && selectedPhoto.ownerId === profile.id)}
          onOpenOwner={openPhotoOwner}
          onDelete={deletePhoto}
          photo={selectedPhoto}
          photos={viewerPhotos.length ? viewerPhotos : allPhotos}
          setSelectedPhotoId={setSelectedPhotoId}
        />
      ) : null}
      {pendingCaptureSrc ? (
        <SharePhotoSheet
          groups={groups}
          photoUploading={photoUploading}
          src={pendingCaptureSrc}
          onCancel={() => setPendingCaptureSrc(null)}
          onShare={(target, caption) => void uploadCapturedPhoto(pendingCaptureSrc, target, caption)}
        />
      ) : null}
      {pendingInvite ? (
        <InvitePrompt
          invite={pendingInvite}
          onAccept={() => void acceptInvite(pendingInvite.token)}
          onDecline={() => void declineInvite(pendingInvite.token)}
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
    return <EmptyPanel title="No photos yet" body="Use the camera to capture your first memory." />;
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
  photos,
  searchResults,
  selectedConnection,
  onBack,
  onOpenProfile,
  onRemoveConnection,
  onSearch,
  onSendRequest
}: {
  openPhoto: OpenPhoto;
  photos: PhotoItem[];
  searchResults: ConnectionProfile[];
  selectedConnection: ConnectionProfile | null;
  onBack: () => void;
  onOpenProfile: (profileId: string) => void;
  onRemoveConnection: (profileId: string) => void;
  onSearch: (query: string) => void;
  onSendRequest: (profileId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const owners = [...new Set(photos.map((photo) => photo.ownerId))];

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void onSearch(query);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  if (selectedConnection) {
    const profilePhotos = photos.filter((photo) => photo.ownerId === selectedConnection.id);
    return (
      <section className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <button className="grid h-10 w-10 place-items-center" onClick={onBack} type="button">
            <ArrowLeft size={21} />
          </button>
          <button
            className="rounded-full border border-line px-3 py-1.5 text-xs text-ink/65 dark:border-white/15 dark:text-paper/65"
            onClick={() => onRemoveConnection(selectedConnection.id)}
            type="button"
          >
            Remove
          </button>
        </div>
        <section className="rounded-lg border border-white/70 bg-white/85 p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#2b2a25]">
          <div className="flex items-center gap-4">
            <Avatar name={selectedConnection.displayName} src={selectedConnection.avatarUrl} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold">{selectedConnection.displayName}</h1>
              <p className="text-sm text-ink/55 dark:text-paper/55">{selectedConnection.username}</p>
              <p className="mt-2 text-xs text-ink/45 dark:text-paper/45">{selectedConnection.preferredTimezone}</p>
            </div>
          </div>
        </section>
        {profilePhotos.length ? (
          <PhotoSection
            label={`${selectedConnection.displayName}'s photos`}
            openPhoto={openPhoto}
            photos={profilePhotos}
            sourcePhotos={profilePhotos}
          />
        ) : (
          <EmptyPanel title="No shared photos yet" body="Connection photos they post will appear here." />
        )}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-7">
      <div>
        <label className="flex items-center gap-2 border-b border-line bg-white/60 px-1 py-3 text-ink dark:border-white/15 dark:bg-transparent dark:text-paper">
          <Search size={19} />
          <input
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink/40 dark:placeholder:text-paper/40"
            placeholder="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {query.trim().length >= 2 ? (
        <section className="grid gap-3">
          {searchResults.length ? (
            searchResults.map((result) => (
              <ConnectionSearchResult
                key={result.id}
                profile={result}
                onOpenProfile={onOpenProfile}
                onSendRequest={onSendRequest}
              />
            ))
          ) : (
            <p className="text-sm text-ink/55 dark:text-paper/55">No matching people yet.</p>
          )}
        </section>
      ) : null}

      {photos.length ? (
        <section className="flex flex-col gap-7">
          {owners.map((owner) => {
            const ownerPhotos = photos.filter((photo) => photo.ownerId === owner);
            const ownerName = ownerPhotos[0]?.owner ?? "someone";
            return (
            <section key={owner}>
              <button className="mb-3 flex items-center gap-3 text-left" onClick={() => onOpenProfile(owner)} type="button">
                <Avatar name={ownerName} src={ownerPhotos[0]?.ownerAvatar} />
                <div>
                  <h2 className="font-semibold">{ownerName}</h2>
                  <p className="text-xs text-ink/55 dark:text-paper/55">
                    {photoTime(ownerPhotos[0])} • {ownerPhotos.length} photos
                  </p>
                </div>
              </button>
              <PhotoStrip openPhoto={openPhoto} photos={ownerPhotos} sourcePhotos={photos} />
            </section>
            );
          })}
        </section>
      ) : query.trim().length < 2 ? (
        <EmptyPanel title="No shared feed yet" body="Search for someone to connect with." />
      ) : null}
    </section>
  );
}

function ConnectionSearchResult({
  profile,
  onOpenProfile,
  onSendRequest
}: {
  profile: ConnectionProfile;
  onOpenProfile: (profileId: string) => void;
  onSendRequest: (profileId: string) => void;
}) {
  const canOpen = profile.relationship === "connected";
  const actionLabel =
    profile.relationship === "connected"
      ? "View"
      : profile.relationship === "pending_sent"
        ? "Requested"
        : profile.relationship === "pending_received"
          ? "Accept in notifications"
          : "Connect";

  return (
    <article className="flex items-center gap-3 rounded-lg border border-white/70 bg-white/85 p-3 shadow-sm dark:border-white/15 dark:bg-[#2b2a25]">
      <button
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        disabled={!canOpen}
        onClick={() => onOpenProfile(profile.id)}
        type="button"
      >
        <Avatar name={profile.displayName} src={profile.avatarUrl} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{profile.displayName}</p>
          <p className="truncate text-sm text-ink/55 dark:text-paper/55">{profile.username}</p>
        </div>
      </button>
      <button
        className={clsx(
          "rounded-full px-3 py-1.5 text-xs font-medium",
          profile.relationship === "none"
            ? "bg-ink text-paper dark:bg-paper dark:text-ink"
            : "border border-line text-ink/60 dark:border-white/15 dark:text-paper/60"
        )}
        disabled={profile.relationship === "pending_sent" || profile.relationship === "pending_received"}
        onClick={() => (profile.relationship === "connected" ? onOpenProfile(profile.id) : onSendRequest(profile.id))}
        type="button"
      >
        {actionLabel}
      </button>
    </article>
  );
}

function GroupsView({
  activeGroup,
  activeGroupId,
  groups,
  notifyGroupMembers,
  onOpenGroupCalendar,
  onOpenProfile,
  openPhoto,
  photos,
  profile,
  reload,
  setActiveGroupId,
  setMessage
}: {
  activeGroup: Group | null;
  activeGroupId: string | null;
  groups: Group[];
  notifyGroupMembers: (groupId: string, message: string, metadata?: Record<string, unknown>) => Promise<void>;
  onOpenGroupCalendar: (groupId: string) => void;
  onOpenProfile: (profileId: string, displayName?: string) => void;
  openPhoto: OpenPhoto;
  photos: PhotoItem[];
  profile: Profile;
  reload: WorkspaceReload;
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
          notifyGroupMembers={notifyGroupMembers}
          photos={photos}
          profile={profile}
          reload={reload}
          setActiveGroupId={setActiveGroupId}
          setMessage={setMessage}
        />
      ) : (
        <GroupGallery
          group={activeGroup}
          notifyGroupMembers={notifyGroupMembers}
          onOpenGroupCalendar={onOpenGroupCalendar}
          onOpenProfile={onOpenProfile}
          openPhoto={openPhoto}
          photos={selectedGroupPhotos}
          profile={profile}
          reload={reload}
          setActiveGroupId={setActiveGroupId}
          setMessage={setMessage}
        />
      )}
    </section>
  );
}

function ProfileView({
  connections,
  groups,
  openPhoto,
  photos,
  profile,
  onOpenConnection,
  onOpenGroups
}: {
  connections: ConnectionProfile[];
  groups: Group[];
  openPhoto: OpenPhoto;
  photos: PhotoItem[];
  profile: Profile;
  onOpenConnection: (profileId: string) => void;
  onOpenGroups: () => void;
}) {
  const ownPhotos = photos.filter((photo) => photo.ownerId === profile.id);
  const [showConnections, setShowConnections] = useState(false);

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-lg border border-white/70 bg-white/85 p-5 text-center shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#2b2a25]">
        <Avatar name={profile.display_name} src={profile.avatar_url ?? ""} size="lg" className="mx-auto" />
        <h1 className="mt-3 text-2xl font-semibold">{profile.display_name}</h1>
        <p className="text-sm text-ink/55 dark:text-paper/55">{profile.username}</p>
        <div className="mt-4 grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-paper/70 text-center dark:divide-white/15 dark:border-white/15 dark:bg-[#23231f]">
          <button className="px-2 py-3" onClick={() => setShowConnections(false)} type="button">
            <span className="block text-lg font-semibold">{ownPhotos.length}</span>
            <span className="text-xs text-ink/55 dark:text-paper/55">Photos</span>
          </button>
          <button className="px-2 py-3" onClick={() => setShowConnections((value) => !value)} type="button">
            <span className="block text-lg font-semibold">{connections.length}</span>
            <span className="text-xs text-ink/55 dark:text-paper/55">Connections</span>
          </button>
          <button className="px-2 py-3" onClick={onOpenGroups} type="button">
            <span className="block text-lg font-semibold">{groups.length}</span>
            <span className="text-xs text-ink/55 dark:text-paper/55">Groups</span>
          </button>
        </div>
      </div>

      {showConnections ? (
        connections.length ? (
          <section className="grid gap-3">
            {connections.map((connection) => (
              <button
                key={connection.id}
                className="flex items-center gap-3 rounded-lg border border-white/70 bg-white/85 p-3 text-left shadow-sm dark:border-white/15 dark:bg-[#2b2a25]"
                onClick={() => onOpenConnection(connection.id)}
                type="button"
              >
                <Avatar name={connection.displayName} src={connection.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{connection.displayName}</p>
                  <p className="truncate text-sm text-ink/55 dark:text-paper/55">{connection.username}</p>
                </div>
              </button>
            ))}
          </section>
        ) : (
          <EmptyPanel title="No connections yet" body="Search usernames from the Connections tab." />
        )
      ) : ownPhotos.length ? (
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
  eventToOpenId,
  events,
  groups,
  notifyGroupMembers,
  profile,
  reload,
  selectedDayEvents,
  selectedDate,
  setCalendarGroupId,
  setEventToOpenId,
  setMessage,
  setSelectedDate,
  setView,
  timezone,
  view
}: {
  calendarGroup: Group | null;
  calendarGroupId: string;
  eventToOpenId: string | null;
  events: EventItem[];
  groups: Group[];
  notifyGroupMembers: (groupId: string, message: string, metadata?: Record<string, unknown>) => Promise<void>;
  profile: Profile;
  reload: WorkspaceReload;
  selectedDayEvents: EventItem[];
  selectedDate: string;
  setCalendarGroupId: (id: string) => void;
  setEventToOpenId: (id: string | null) => void;
  setMessage: (value: string) => void;
  setSelectedDate: (value: string) => void;
  setView: (view: ViewMode) => void;
  timezone: string;
  view: ViewMode;
}) {
  const writableGroup = calendarGroup ?? groups[0] ?? null;
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventGroupId, setEventGroupId] = useState(writableGroup?.id ?? "");
  const editingEvent = editingEventId ? events.find((event) => event.id === editingEventId) ?? null : null;
  const editableGroups = groups.filter((group) => group.role === "owner" || group.role === "editor");
  const formGroup =
    groups.find((group) => group.id === eventGroupId) ??
    (editingEvent ? groups.find((group) => group.id === editingEvent.group_id) : null) ??
    writableGroup;

  useEffect(() => {
    if (eventModalOpen || editingEvent) return;
    setEventGroupId(writableGroup?.id ?? "");
  }, [eventModalOpen, editingEvent, writableGroup?.id]);

  useEffect(() => {
    if (!eventToOpenId) return;
    const event = events.find((item) => item.id === eventToOpenId);
    if (!event) return;
    setEditingEventId(event.id);
    setEventGroupId(event.group_id);
    setEventModalOpen(true);
    setEventToOpenId(null);
  }, [eventToOpenId, events, setEventToOpenId]);

  function openAddEvent() {
    const defaultGroup =
      calendarGroupId !== "all"
        ? editableGroups.find((group) => group.id === calendarGroupId)
        : editableGroups[0] ?? writableGroup;
    setEditingEventId(null);
    setEventGroupId(defaultGroup?.id ?? "");
    setEventModalOpen(true);
  }

  function closeEventModal() {
    setEditingEventId(null);
    setEventModalOpen(false);
  }

  async function deleteEvent(event: EventItem) {
    if (!supabase) return;
    const confirmed = window.confirm(`Delete ${event.title}?`);
    if (!confirmed) return;

    setMessage("");
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) {
      setMessage(`Failed to delete calendar event. ${error.message}`);
      return;
    }
    if (editingEventId === event.id) setEditingEventId(null);
    const eventGroup = groups.find((group) => group.id === event.group_id);
    const eventDate = localDateTime(event, profile.preferred_timezone).toISODate() ?? selectedDate;
    await notifyGroupMembers(
      event.group_id,
      `${profile.display_name} deleted ${event.title}${eventGroup ? ` from ${eventGroup.name}` : ""}.`,
      {
        type: "calendar_event",
        action: "deleted",
        eventId: event.id,
        eventTitle: event.title,
        eventDate,
        groupId: event.group_id,
        summary: "Event deleted"
      }
    );
    await reload();
    setMessage("Calendar event deleted successfully.");
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
        <select
          className="min-w-0 flex-1 rounded-lg border border-white/70 bg-white/90 px-3 py-2 text-sm text-ink shadow-sm outline-none dark:border-white/15 dark:bg-[#2b2a25] dark:text-paper sm:w-44"
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
          <button
            aria-label="Add event"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/70 bg-white/90 text-ink shadow-sm transition hover:bg-paper disabled:opacity-35 dark:border-white/15 dark:bg-[#2b2a25] dark:text-paper"
            disabled={!editableGroups.length}
            onClick={openAddEvent}
            type="button"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="flex rounded-full border border-line bg-paper p-1 dark:border-white/15 dark:bg-[#23231f]">
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
          editableGroups={editableGroups.map((group) => group.id)}
          emptyBody="Pick a date or add a shared plan for a group."
          events={selectedDayEvents}
          onDelete={(event) => void deleteEvent(event)}
          onEdit={(event) => {
            setCalendarGroupId(event.group_id);
            setEditingEventId(event.id);
            setEventGroupId(event.group_id);
            setEventModalOpen(true);
          }}
          timezone={timezone}
        />
        <EmptyPanel
          title={editableGroups.length ? "Add with +" : "No editable groups"}
          body={editableGroups.length ? "Use the plus next to Calendar when you are ready to add a shared plan." : "Create or join a group as an editor before adding calendar plans."}
        />
      </div>
      {eventModalOpen && formGroup ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/45 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-ink sm:items-center">
          <EventForm
            editingEvent={editingEvent}
            group={formGroup}
            groups={editableGroups}
            onCancelEdit={closeEventModal}
            onGroupChange={setEventGroupId}
            onSaved={(savedGroupId, savedDate) => {
              setCalendarGroupId(savedGroupId);
              setSelectedDate(savedDate);
            }}
            notifyGroupMembers={notifyGroupMembers}
            profile={profile}
            reload={reload}
            selectedDate={selectedDate}
            setMessage={setMessage}
          />
        </div>
      ) : null}
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
    ["connections", "Connections", <Users key="connections" size={18} />],
    ["groups", "Groups", <Users key="groups" size={18} />],
    ["calendar", "Calendar", <CalendarDays key="calendar" size={18} />],
    ["gallery", "Gallery", <ImageIcon key="gallery" size={18} />],
    ["profile", "Profile", <User key="profile" size={18} />]
  ];

  return (
    <nav className="app-bottom-nav fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/92 px-3 pt-2 backdrop-blur dark:border-white/15 dark:bg-[#23231f]/95">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {items.map(([tab, label, icon]) => (
          <button
            key={tab}
            className={clsx(
              "flex min-w-0 flex-col items-center gap-1 px-1 py-1.5 text-[0.68rem]",
              activeTab === tab ? "text-[#65745a]" : "text-ink/55 dark:text-paper/55"
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
  canDelete,
  canOpenOwner,
  onOpenOwner,
  onDelete,
  photo,
  photos,
  setSelectedPhotoId
}: {
  canDelete: boolean;
  canOpenOwner: boolean;
  onOpenOwner: (photo: PhotoItem) => void;
  onDelete: (photo: PhotoItem) => void;
  photo: PhotoItem;
  photos: PhotoItem[];
  setSelectedPhotoId: (id: string | null) => void;
}) {
  const currentIndex = Math.max(0, photos.findIndex((item) => item.id === photo.id));
  const previousPhoto = photos.length > 1 ? photos[(currentIndex - 1 + photos.length) % photos.length] : null;
  const nextPhoto = photos.length > 1 ? photos[(currentIndex + 1) % photos.length] : null;
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const finishSwipe = (x: number, y: number) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;

    const deltaX = x - start.x;
    const deltaY = y - start.y;
    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    if (deltaX < 0 && nextPhoto) setSelectedPhotoId(nextPhoto.id);
    if (deltaX > 0 && previousPhoto) setSelectedPhotoId(previousPhoto.id);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col bg-ink text-paper"
      onTouchStart={(event) => {
        const touch = event.touches[0];
        if (!touch) return;
        swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        const touch = event.changedTouches[0];
        if (!touch) return;
        finishSwipe(touch.clientX, touch.clientY);
      }}
      onTouchCancel={() => {
        swipeStartRef.current = null;
      }}
    >
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
          <button
            className={clsx(
              "flex items-center gap-3 text-left",
              canOpenOwner ? "transition hover:opacity-75" : "cursor-default"
            )}
            disabled={!canOpenOwner}
            onClick={() => onOpenOwner(photo)}
            type="button"
          >
            <Avatar name={photo.owner} src={photo.ownerAvatar} />
            <div>
              <p className="font-semibold">{photo.owner}</p>
              <p className="text-sm text-ink/60">{photo.location}</p>
            </div>
          </button>
          <span />
        </div>
        <p className="text-sm text-ink/60">{photoTime(photo)}</p>
        <p className="mt-3">{photo.caption}</p>
        {canDelete ? (
          <div className="mt-5 flex justify-end border-t border-line pt-4">
            <button aria-label="Delete photo" className="grid h-10 w-10 place-items-center" onClick={() => onDelete(photo)} type="button">
              <Trash2 size={20} />
            </button>
          </div>
        ) : null}
      </div>
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
  onShare: (target: ShareTarget, caption: string) => void;
}) {
  const [caption, setCaption] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<ShareTarget>({ type: "connections" });
  const selectedKey = selectedTarget.type === "group" ? `group:${selectedTarget.groupId}` : "connections";

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/45 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-ink">
      <section className="mx-auto w-full max-w-md bg-white p-4 shadow-soft dark:bg-[#2b2a25] dark:text-paper">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Share to</h2>
            <p className="text-sm text-ink/55 dark:text-paper/55">Choose where this photo should live.</p>
          </div>
          <button className="text-sm text-ink/60 dark:text-paper/60" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>

        <div className="mb-4 aspect-square w-full overflow-hidden bg-paper dark:bg-[#23231f]">
          <img alt="Captured preview" className={memoryPhotoClass} src={src} />
        </div>

        <textarea
          className="mb-4 min-h-24 w-full rounded-lg border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-moss dark:border-white/15 dark:bg-[#23231f] dark:text-paper"
          placeholder="Add a caption"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          disabled={photoUploading}
        />

        <div className="grid gap-2">
          <button
            className={clsx(
              "flex items-center justify-between border px-3 py-3 text-left transition dark:border-white/15",
              selectedKey === "connections" ? "border-ink bg-paper dark:border-paper dark:bg-[#23231f]" : "border-line"
            )}
            disabled={photoUploading}
            onClick={() => setSelectedTarget({ type: "connections" })}
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
              className={clsx(
                "flex items-center justify-between border px-3 py-3 text-left transition dark:border-white/15",
                selectedKey === `group:${group.id}` ? "border-ink bg-paper dark:border-paper dark:bg-[#23231f]" : "border-line"
              )}
              disabled={photoUploading}
              onClick={() => setSelectedTarget({ type: "group", groupId: group.id })}
              type="button"
            >
              <span>
                <span className="block font-medium">{group.name}</span>
                <span className="block text-sm text-ink/55 dark:text-paper/55">
                  {group.member_count} {group.member_count === 1 ? "member" : "members"}
                </span>
              </span>
              <Users size={18} />
            </button>
          ))}
        </div>

        <button
          className="mt-4 w-full rounded-full bg-ink px-4 py-3 font-medium text-paper transition disabled:opacity-45 dark:bg-paper dark:text-ink"
          disabled={photoUploading}
          onClick={() => onShare(selectedTarget, caption)}
          type="button"
        >
          {photoUploading ? "Uploading..." : "Upload"}
        </button>

        {photoUploading ? <p className="mt-3 text-sm text-ink/55 dark:text-paper/55">Saving photo...</p> : null}
      </section>
    </div>
  );
}

function NotificationCenter({
  connectionRequests,
  groupNotifications,
  invites,
  onAcceptConnection,
  onAcceptGroup,
  onDeclineConnection,
  onDeclineGroup,
  onOpenGroupNotification
}: {
  connectionRequests: ConnectionRequest[];
  groupNotifications: GroupNotification[];
  invites: GroupInvite[];
  onAcceptConnection: (requesterId: string) => void;
  onAcceptGroup: (token: string) => void;
  onDeclineConnection: (requesterId: string) => void;
  onDeclineGroup: (token: string) => void;
  onOpenGroupNotification: (notification: GroupNotification) => void;
}) {
  const unreadGroupNotifications = groupNotifications.filter((notification) => !notification.readAt);
  const total = invites.length + connectionRequests.length + unreadGroupNotifications.length;
  const hasHistory = Boolean(groupNotifications.length);

  return (
    <section className="absolute right-0 top-12 z-20 w-[min(23rem,calc(100vw-2rem))] rounded-lg border border-line bg-white p-4 text-left shadow-soft dark:border-white/15 dark:bg-[#2b2a25]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Notifications</h2>
        {total ? <span className="text-xs text-ink/55 dark:text-paper/55">{total} pending</span> : null}
      </div>
      {total || hasHistory ? (
        <div className="grid max-h-[min(32rem,calc(100dvh-9rem))] gap-3 overflow-y-auto pr-1">
          {groupNotifications.map((notification) => (
            <button
              key={notification.id}
              className={clsx(
                "rounded-lg border p-3 text-left transition hover:border-ink/25 hover:bg-white dark:border-white/15 dark:hover:border-paper/25 dark:hover:bg-[#2b2a25]",
                notification.readAt
                  ? "border-line bg-white dark:bg-[#23231f]"
                  : "border-moss/40 bg-skysoft/55 dark:bg-[#263029]"
              )}
              onClick={() => onOpenGroupNotification(notification)}
              type="button"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{notification.groupName}</p>
                  <p className="mt-0.5 text-[0.68rem] uppercase tracking-[0.14em] text-ink/35 dark:text-paper/35">
                    {notificationTime(notification.createdAt)}
                  </p>
                </div>
              </div>
              <p className="mt-1 text-xs leading-5 text-ink/60 dark:text-paper/60">{notification.message}</p>
              {typeof notification.metadata.summary === "string" ? (
                <p className="mt-2 rounded-md bg-white px-2 py-1.5 text-xs leading-5 text-ink/55 dark:bg-[#2b2a25] dark:text-paper/55">
                  {notification.metadata.summary}
                </p>
              ) : null}
            </button>
          ))}
          {connectionRequests.map((request) => (
            <article key={request.requesterId} className="rounded-lg border border-line bg-paper p-3 dark:border-white/15 dark:bg-[#23231f]">
              <div className="flex items-center gap-3">
                <Avatar name={request.displayName} src={request.avatarUrl} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{request.displayName}</p>
                  <p className="truncate text-xs text-ink/60 dark:text-paper/60">{request.username} wants to connect.</p>
                  <p className="mt-1 text-[0.68rem] uppercase tracking-[0.14em] text-ink/35 dark:text-paper/35">
                    {notificationTime(request.createdAt)}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="rounded-full bg-ink px-3 py-2 text-sm font-medium text-paper dark:bg-paper dark:text-ink"
                  onClick={() => onAcceptConnection(request.requesterId)}
                  type="button"
                >
                  Accept
                </button>
                <button
                  className="rounded-full border border-line px-3 py-2 text-sm font-medium dark:border-white/15"
                  onClick={() => onDeclineConnection(request.requesterId)}
                  type="button"
                >
                  Decline
                </button>
              </div>
            </article>
          ))}
          {invites.map((invite) => (
            <article key={invite.id} className="rounded-lg border border-line bg-paper p-3 dark:border-white/15 dark:bg-[#23231f]">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{invite.groupName}</p>
                <p className="text-[0.68rem] uppercase tracking-[0.14em] text-ink/35 dark:text-paper/35">
                  {notificationTime(invite.createdAt)}
                </p>
              </div>
              <p className="mt-1 text-xs leading-5 text-ink/60 dark:text-paper/60">
                {invite.inviterName} invited you as {invite.role}.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="rounded-full bg-ink px-3 py-2 text-sm font-medium text-paper dark:bg-paper dark:text-ink"
                  onClick={() => onAcceptGroup(invite.token)}
                  type="button"
                >
                  Accept
                </button>
                <button
                  className="rounded-full border border-line px-3 py-2 text-sm font-medium dark:border-white/15"
                  onClick={() => onDeclineGroup(invite.token)}
                  type="button"
                >
                  Decline
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink/60 dark:text-paper/60">No new notifications.</p>
      )}
    </section>
  );
}

function InvitePrompt({
  invite,
  onAccept,
  onDecline
}: {
  invite: InvitePreview;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4 text-ink">
      <section className="w-full max-w-sm rounded-lg bg-white p-5 shadow-soft dark:bg-[#2b2a25] dark:text-paper">
        <div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-skysoft text-ink">
          <UserPlus size={19} />
        </div>
        <h2 className="text-xl font-semibold">Join {invite.groupName}?</h2>
        <p className="mt-2 text-sm leading-6 text-ink/65 dark:text-paper/65">
          {invite.inviterName} invited you to this group. If you accept, shared photos and calendar events for this group will appear in your app.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            className="rounded-full bg-ink px-4 py-3 text-sm font-medium text-paper dark:bg-paper dark:text-ink"
            onClick={onAccept}
            type="button"
          >
            Join group
          </button>
          <button
            className="rounded-full border border-line px-4 py-3 text-sm font-medium dark:border-white/15"
            onClick={onDecline}
            type="button"
          >
            Not now
          </button>
        </div>
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
      {src ? <img alt="" className="h-full w-full object-cover" src={src} /> : name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function ConnectionLogo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div
      className={clsx(
        "select-none text-center font-semibold lowercase tracking-normal text-ink dark:text-paper",
        compact ? "text-xl leading-none sm:text-2xl" : "text-3xl",
        className
      )}
      aria-label="Connection"
    >
      connection
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
    const pendingInvite = localStorage.getItem("connection-pending-invite");
    const emailRedirectTo =
      mode === "signup"
        ? appUrl(pendingInvite ? `/?invite=${encodeURIComponent(pendingInvite)}` : "/")
        : undefined;

    const { data, error } =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo
            }
          })
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

        <div className="w-full rounded-lg border border-white/70 bg-white/95 p-5 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#2b2a25] sm:p-6">
          <div className="mb-6">
            <ConnectionLogo className="mb-5" />
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
        <div className="rounded-lg border border-white/70 bg-white/80 p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#2b2a25]">
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
                className="aspect-square bg-[radial-gradient(circle_at_35%_35%,#f4f1ea_0,#c7c3ba_32%,#2b2b29_100%)]"
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
      <section className="w-full max-w-md rounded-lg border border-white/70 bg-white/95 p-5 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#2b2a25]">
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
    <section className="rounded-lg border border-white/70 bg-white/85 p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#2b2a25]">
      <div className="flex items-center gap-3">
        <Avatar name={profile.display_name} src={profile.avatar_url ?? ""} />
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{profile.display_name}</h2>
          <p className="truncate text-sm text-ink/60 dark:text-paper/60">{profile.username}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-2 text-sm dark:border-white/15 dark:bg-[#23231f]">
        <Clock3 size={16} />
        <span className="truncate">{profile.preferred_timezone}</span>
      </div>
    </section>
  );
}

function AccountMenu({
  darkMode,
  onClose,
  profile,
  reload,
  setDarkMode,
  setMessage
}: {
  darkMode: boolean;
  onClose: () => void;
  profile: Profile;
  reload: WorkspaceReload;
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
      await reload();
      setMessage("Profile picture updated.");
      onClose();
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
      await reload();
      setMessage("Account settings updated.");
      onClose();
    }

    setBusy(false);
  }

  function toggleDarkMode() {
    const nextDarkMode = !darkMode;
    setDarkMode(nextDarkMode);
    setMessage(nextDarkMode ? "Dark mode on." : "Dark mode off.");
    onClose();
  }

  return (
    <div className="absolute right-0 top-12 z-20 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-line bg-white p-4 text-left shadow-soft dark:border-white/15 dark:bg-[#2b2a25]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={displayName} src={avatarUrl} />
          <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-rust">Settings</p>
          <p className="text-sm font-semibold">{profile.display_name}</p>
          <p className="text-xs text-ink/55 dark:text-paper/55">{profile.username}</p>
          </div>
        </div>
        <button
          className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs dark:border-white/15"
          onClick={toggleDarkMode}
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
  notifyGroupMembers,
  photos,
  profile,
  setActiveGroupId,
  reload,
  setMessage
}: {
  groups: Group[];
  activeGroupId: string | null;
  notifyGroupMembers: (groupId: string, message: string, metadata?: Record<string, unknown>) => Promise<void>;
  photos: PhotoItem[];
  profile: Profile;
  setActiveGroupId: (value: string | null) => void;
  reload: WorkspaceReload;
  setMessage: (value: string) => void;
}) {
  const [name, setName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<ConnectionProfile[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [actionGroupId, setActionGroupId] = useState<string | null>(null);
  const [inviteGroupId, setInviteGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

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
      setMessage(`Failed to create group. ${groupError.message}`);
      return;
    }

    if (selectedMembers.length) {
      const invites = selectedMembers
        .filter((member) => member.id !== user.id)
        .map((member) => ({
          group_id: group.id,
          token: crypto.randomUUID().replaceAll("-", ""),
          role: "editor" as const,
          created_by: user.id,
          invitee_id: member.id
        }));

      if (invites.length) {
        const { error: inviteError } = await supabase.from("group_invites").insert(invites);
        if (inviteError) {
          setMessage(`Group saved, but failed to invite members. ${inviteError.message}`);
          await reload();
          return;
        }
      }
    }

    setName("");
    setSelectedMembers([]);
    setAddOpen(false);
    await reload();
    setMessage(selectedMembers.length ? "Group saved successfully. Invites sent." : "Group saved successfully.");
  }

  function startRename(group: Group) {
    setActionGroupId(null);
    setInviteGroupId(null);
    setEditingGroupId(group.id);
    setEditingName(group.name);
  }

  async function renameGroup(event: FormEvent, group: Group) {
    event.preventDefault();
    if (!supabase || !editingName.trim()) return;
    setMessage("");

    const { error } = await supabase
      .from("groups")
      .update({ name: editingName.trim() })
      .eq("id", group.id);

    if (error) {
      setMessage(`Failed to update group. ${error.message}`);
      return;
    }

    setEditingGroupId(null);
    setEditingName("");
    if (group.name !== editingName.trim()) {
      await notifyGroupMembers(group.id, `${profile.display_name} renamed ${group.name} to ${editingName.trim()}.`);
    }
    await reload();
    setMessage("Group updated successfully.");
  }

  async function deleteGroup(group: Group) {
    if (!supabase) return;
    if (group.role !== "owner") {
      setMessage(`Only admin ${group.owner_username} can delete this group.`);
      return;
    }

    const confirmed = window.confirm(`Delete ${group.name}? This removes its calendar, invites, and membership for everyone.`);
    if (!confirmed) return;
    setMessage("");

    const { error } = await supabase.from("groups").delete().eq("id", group.id);

    if (error) {
      setMessage(`Failed to delete group. ${error.message}`);
      return;
    }

    if (activeGroupId === group.id) setActiveGroupId(null);
    await reload();
    setMessage("Group deleted successfully.");
  }

  return (
    <section>
      <div className="mb-5">
        <div className="flex items-center justify-end gap-3">
          <button
            aria-label="Add group"
            className="grid h-8 w-8 place-items-center text-ink/75 transition hover:text-ink dark:text-paper/75 dark:hover:text-paper"
            onClick={() => {
              setInviteGroupId(null);
              setActionGroupId(null);
              setEditingGroupId(null);
              setAddOpen((value) => !value);
            }}
            type="button"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {addOpen ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/45 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-ink sm:items-center">
          <form className="mx-auto w-full max-w-lg rounded-t-2xl border border-white/70 bg-white p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#2b2a25] dark:text-paper sm:rounded-2xl" onSubmit={createGroup}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Plus size={18} />
                <h2 className="font-semibold">New group</h2>
              </div>
              <button
                aria-label="Close new group"
                className="grid h-9 w-9 place-items-center rounded-full border border-line dark:border-white/15"
                onClick={() => setAddOpen(false)}
                type="button"
              >
                <X size={17} />
              </button>
            </div>
            <div className="grid gap-3">
              <input
                className="rounded-full border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-moss dark:border-white/15 dark:bg-[#23231f] dark:text-paper"
                placeholder="Group name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
              <UsernameSearchPicker
                excludeIds={[profile.id, ...selectedMembers.map((member) => member.id)]}
                onSelect={(member) => setSelectedMembers((current) => [...current, member])}
                placeholder="Search"
                setMessage={setMessage}
              />
              {selectedMembers.length ? (
                <div className="flex flex-wrap gap-2">
                  {selectedMembers.map((member) => (
                    <button
                      key={member.id}
                      className="rounded-full border border-line px-3 py-1 text-sm dark:border-white/15"
                      onClick={() => setSelectedMembers((current) => current.filter((item) => item.id !== member.id))}
                      type="button"
                    >
                      {member.username} <X className="inline" size={13} />
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <button className="rounded-full border border-line px-4 py-2 text-sm dark:border-white/15" onClick={() => setAddOpen(false)} type="button">
                  Cancel
                </button>
                <button className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper dark:bg-paper dark:text-ink">
                  Create
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      <div className="grid gap-3">
        {groups.map((group) => {
          const groupPhotos = photos.filter((photo) => photo.groupId === group.id);
          const latestPhoto = groupPhotos[0] ?? null;
          const isEditing = editingGroupId === group.id;
          return (
            <article key={group.id} className="rounded-lg border border-white/70 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-white/15 dark:bg-[#2b2a25]">
              {isEditing ? (
                <form className="flex items-center gap-2" onSubmit={(event) => void renameGroup(event, group)}>
                  <GroupThumb groupId={group.id} photos={photos} />
                  <input
                    className="min-w-0 flex-1 rounded-full border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-moss dark:border-white/15 dark:bg-[#23231f] dark:text-paper"
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    autoFocus
                  />
                  <button aria-label="Save group name" className="grid h-10 w-10 place-items-center rounded-full bg-ink text-paper dark:bg-paper dark:text-ink">
                    <Check size={17} />
                  </button>
                  <button
                    aria-label="Cancel rename"
                    className="grid h-10 w-10 place-items-center rounded-full border border-line dark:border-white/15"
                    onClick={() => setEditingGroupId(null)}
                    type="button"
                  >
                    <X size={17} />
                  </button>
                </form>
              ) : (
                <div className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3">
                  <button
                    className="contents text-left"
                    onClick={() => setActiveGroupId(group.id)}
                    type="button"
                  >
                    <GroupThumb groupId={group.id} photos={photos} />
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-semibold">{group.name}</span>
                      <span className="block truncate text-sm text-ink/55 dark:text-paper/55">
                        {latestPhoto ? `${latestPhoto.owner} • ${photoTime(latestPhoto)}` : "No photos yet"}
                      </span>
                      <span className="block text-sm text-ink/55 dark:text-paper/55">
                        {group.member_count} {group.member_count === 1 ? "member" : "members"}
                      </span>
                    </span>
                  </button>
                  <button
                    aria-label={`Edit ${group.name}`}
                    className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white/75 text-ink/65 transition hover:bg-paper dark:border-white/15 dark:bg-[#23231f] dark:text-paper/65"
                    onClick={() => {
                      setEditingGroupId(null);
                      setInviteGroupId(null);
                      setActionGroupId((current) => (current === group.id ? null : group.id));
                    }}
                    type="button"
                  >
                    <Pencil size={17} />
                  </button>
                </div>
              )}
              {actionGroupId === group.id ? (
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 dark:border-white/15">
                  <button
                    className="flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-40 dark:border-white/15"
                    disabled={group.role !== "owner"}
                    onClick={() => startRename(group)}
                    type="button"
                  >
                    <Pencil size={15} />
                    Rename
                  </button>
                  <button
                    className="flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm dark:border-white/15"
                    onClick={() => void deleteGroup(group)}
                    type="button"
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
                  <button
                    className="flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm dark:border-white/15"
                    onClick={() => {
                      setActionGroupId(null);
                      setInviteGroupId((current) => (current === group.id ? null : group.id));
                    }}
                    type="button"
                  >
                    <UserPlus size={15} />
                    Invite
                  </button>
                </div>
              ) : null}
              {inviteGroupId === group.id ? (
                <div className="mt-3">
                  <MemberPanel
                    group={group}
                    notifyGroupMembers={notifyGroupMembers}
                    profile={profile}
                    reload={reload}
                    setMessage={setMessage}
                  />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function GroupThumb({ groupId, photos }: { groupId: string; photos: PhotoItem[] }) {
  const image = photos.find((photo) => photo.groupId === groupId)?.src;

  return (
    <span className="block h-16 w-16 overflow-hidden rounded-lg bg-paper dark:bg-[#23231f]">
      {image ? <img alt="" className={memoryPhotoClass} src={image} /> : null}
    </span>
  );
}

function UsernameSearchPicker({
  excludeIds,
  onSelect,
  placeholder,
  setMessage
}: {
  excludeIds: string[];
  onSelect: (profile: ConnectionProfile) => void;
  placeholder: string;
  setMessage: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ConnectionProfile[]>([]);
  const excludeKey = excludeIds.join("|");

  useEffect(() => {
    if (!supabase || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      supabase
        .rpc("search_profiles", { search_text: query.trim() })
        .then(({ data, error }) => {
          if (error) {
            setMessage(`Failed to search users. ${error.message}`);
            return;
          }
          setResults(
            ((data ?? []) as ConnectionProfileRow[])
              .map(mapConnectionProfile)
              .filter((profile) => !excludeIds.includes(profile.id))
          );
        });
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [excludeKey, query, setMessage]);

  function selectProfile(profile: ConnectionProfile) {
    onSelect(profile);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="relative">
      <input
        className="w-full rounded-full border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-moss dark:border-white/15 dark:bg-[#23231f] dark:text-paper"
        placeholder={placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {results.length ? (
        <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-10 overflow-hidden rounded-lg border border-line bg-white shadow-soft dark:border-white/15 dark:bg-[#23231f]">
          {results.map((result) => (
            <button
              key={result.id}
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-paper dark:hover:bg-[#2b2a25]"
              onClick={() => selectProfile(result)}
              type="button"
            >
              <Avatar name={result.displayName} src={result.avatarUrl} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{result.displayName}</span>
                <span className="block truncate text-xs text-ink/55 dark:text-paper/55">{result.username}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GroupGallery({
  group,
  notifyGroupMembers,
  onOpenGroupCalendar,
  onOpenProfile,
  openPhoto,
  photos,
  profile,
  reload,
  setMessage,
  setActiveGroupId
}: {
  group: Group;
  notifyGroupMembers: (groupId: string, message: string, metadata?: Record<string, unknown>) => Promise<void>;
  onOpenGroupCalendar: (groupId: string) => void;
  onOpenProfile: (profileId: string, displayName?: string) => void;
  openPhoto: OpenPhoto;
  photos: PhotoItem[];
  profile: Profile;
  reload: WorkspaceReload;
  setMessage: (value: string) => void;
  setActiveGroupId: (id: string | null) => void;
}) {
  const owners = [...new Set(photos.map((photo) => photo.ownerId))];
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <section className="flex flex-col gap-7">
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_5.5rem] items-start">
        <button aria-label="Back to groups" className="grid h-10 w-10 place-items-center" onClick={() => setActiveGroupId(null)}>
          <ArrowLeft size={23} />
        </button>
        <div className="text-center">
          <h1 className="text-lg font-semibold">{group.name}</h1>
          <p className="text-xs text-ink/55 dark:text-paper/55">
            {group.member_count} {group.member_count === 1 ? "member" : "members"}
          </p>
        </div>
        <div className="flex justify-end gap-1">
          <button
            aria-label={`${group.name} calendar`}
            className="grid h-10 w-10 place-items-center"
            onClick={() => onOpenGroupCalendar(group.id)}
            type="button"
          >
            <CalendarDays size={20} />
          </button>
          <button
            aria-label={`Invite to ${group.name}`}
            className="grid h-10 w-10 place-items-center"
            onClick={() => setInviteOpen((value) => !value)}
            type="button"
          >
            <UserPlus size={20} />
          </button>
        </div>
      </div>

      {inviteOpen ? (
        <MemberPanel
          group={group}
          notifyGroupMembers={notifyGroupMembers}
          profile={profile}
          reload={reload}
          setMessage={setMessage}
        />
      ) : null}

      {photos.length ? (
        owners.map((owner) => {
          const ownerPhotos = photos.filter((photo) => photo.ownerId === owner);
          const ownerName = ownerPhotos[0]?.owner ?? "someone";
          return (
            <section key={owner}>
              <button
                className="mb-3 flex items-center gap-3 text-left transition hover:opacity-75"
                onClick={() => onOpenProfile(owner, ownerName)}
                type="button"
              >
                <Avatar name={ownerName} src={ownerPhotos[0]?.ownerAvatar} />
                <p className="text-sm text-ink/55 dark:text-paper/55">
                  <span className="font-medium text-ink dark:text-paper">{ownerName}</span> {photoTime(ownerPhotos[0])}
                </p>
              </button>
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
  notifyGroupMembers,
  profile,
  reload,
  setMessage
}: {
  group: Group;
  notifyGroupMembers: (groupId: string, message: string, metadata?: Record<string, unknown>) => Promise<void>;
  profile: Profile;
  reload: WorkspaceReload;
  setMessage: (value: string) => void;
}) {
  const [invitee, setInvitee] = useState<ConnectionProfile | null>(null);
  const [busyLink, setBusyLink] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  async function inviteMember(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !invitee) return;
    setMessage("");

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Authentication required.");
      return;
    }

    const token = crypto.randomUUID().replaceAll("-", "");
    const { error } = await supabase
      .from("group_invites")
      .insert({
        group_id: group.id,
        token,
        role: "editor",
        created_by: user.id,
        invitee_id: invitee.id
      });

    if (error) {
      setMessage(`Failed to send invite. ${error.message}`);
      return;
    }

    await notifyGroupMembers(group.id, `${profile.display_name} invited ${invitee.username} to ${group.name}.`);
    setMessage(`Invite sent to ${invitee.username}.`);
    setInvitee(null);
    await reload();
  }

  async function copyInviteLink() {
    if (!supabase) return;
    setBusyLink(true);
    setMessage("");

    const token = crypto.randomUUID().replaceAll("-", "");
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Authentication required.");
      setBusyLink(false);
      return;
    }

    const { error } = await supabase.from("group_invites").insert({
      group_id: group.id,
      token,
      role: "editor",
      created_by: user.id
    });

    if (error) {
      setMessage(`Failed to create invite link. ${error.message}`);
      setBusyLink(false);
      return;
    }

    const inviteUrl = appUrl(`/?invite=${token}`);
    setInviteLink(inviteUrl);
    const copied = await copyText(inviteUrl);
    setMessage(copied ? "Invite link copied." : "Invite link created. Tap the link to copy it manually.");
    setBusyLink(false);
  }

  return (
    <section className="rounded-lg border border-white/70 bg-white/85 p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#2b2a25]">
      <div className="mb-3 flex items-center gap-2">
        <Shield size={18} />
        <h2 className="font-semibold">Invite</h2>
      </div>
      <form className="flex gap-2" onSubmit={inviteMember}>
        <div className="min-w-0 flex-1">
          {invitee ? (
            <button
              className="flex w-full items-center justify-between rounded-full border border-line bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#23231f]"
              onClick={() => setInvitee(null)}
              type="button"
            >
              {invitee.username}
              <X size={14} />
            </button>
          ) : (
            <UsernameSearchPicker
              excludeIds={[profile.id]}
              onSelect={setInvitee}
              placeholder="Search"
              setMessage={setMessage}
            />
          )}
        </div>
        <button
          aria-label="Invite member"
          disabled={group.role !== "owner" || !invitee}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rust text-ink disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
      <button
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-medium disabled:opacity-45 dark:border-white/15"
        disabled={group.role !== "owner" || busyLink}
        onClick={() => void copyInviteLink()}
        type="button"
      >
        <Copy size={15} />
        Copy invite link
      </button>
      {inviteLink ? (
        <div className="mt-3 grid gap-2">
          <input
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink outline-none dark:border-white/15 dark:bg-[#23231f] dark:text-paper"
            readOnly
            value={inviteLink}
            onFocus={(event) => event.target.select()}
          />
          <button
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper dark:bg-paper dark:text-ink"
            onClick={() => void copyText(inviteLink).then((copied) => setMessage(copied ? "Invite link copied." : "Select and copy the link manually."))}
            type="button"
          >
            Copy shown link
          </button>
        </div>
      ) : null}
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
    <section className="rounded-lg border border-white/70 bg-white/85 p-3 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#2b2a25]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-ink/65 dark:text-paper/65">
          <CalendarDays size={16} />
          <span>{timezone}</span>
        </div>
        <button
          aria-label="Return to today"
          className="grid h-9 w-9 place-items-center rounded-full border border-line bg-paper text-ink dark:border-white/15 dark:bg-[#23231f] dark:text-paper"
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
                  : "border-line bg-paper/80 text-ink hover:border-moss dark:border-white/15 dark:bg-[#23231f] dark:text-paper"
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
  editableGroups,
  emptyBody,
  events,
  onDelete,
  onEdit,
  timezone
}: {
  editableGroups: string[];
  emptyBody: string;
  events: EventItem[];
  onDelete: (event: EventItem) => void;
  onEdit: (event: EventItem) => void;
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
        const canEdit = editableGroups.includes(event.group_id);

        return (
          <article
            key={event.id}
            className="rounded-lg border border-white/70 bg-white/85 p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#2b2a25]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold">{event.title}</h3>
                {event.location ? <p className="text-sm text-ink/60 dark:text-paper/60">{event.location}</p> : null}
              </div>
              <div className="flex items-start gap-2">
                <div className="rounded-lg bg-moss px-3 py-2 text-right text-sm font-medium text-white">
                  <div>{local.toFormat("h:mm a")}</div>
                  <div className="text-xs opacity-80">{local.toFormat("LLL d")}</div>
                </div>
                <div className="flex gap-1">
                  <button
                    aria-label="Download calendar invite"
                    className="grid h-9 w-9 place-items-center rounded-full border border-line bg-paper dark:border-white/15 dark:bg-[#23231f]"
                    onClick={() => downloadEventIcs(event)}
                    type="button"
                  >
                    <Download size={15} />
                  </button>
                  {canEdit ? (
                    <>
                    <button
                      aria-label="Edit event"
                      className="grid h-9 w-9 place-items-center rounded-full border border-line bg-paper dark:border-white/15 dark:bg-[#23231f]"
                      onClick={() => onEdit(event)}
                      type="button"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      aria-label="Delete event"
                      className="grid h-9 w-9 place-items-center rounded-full border border-line bg-paper dark:border-white/15 dark:bg-[#23231f]"
                      onClick={() => onDelete(event)}
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
            {event.description ? (
              <p className="mt-3 text-sm leading-6 text-ink/70 dark:text-paper/70">{event.description}</p>
            ) : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <TimeChip label="Your time" time={local.toFormat("ccc, LLL d, h:mm a")} zone={timezone} />
              <TimeChip label="Entered as" time={original.toFormat("ccc, LLL d, h:mm a")} zone={event.source_timezone} />
            </div>
          </article>
        );
      })}
    </section>
  );
}

function EventForm({
  editingEvent,
  group,
  groups,
  notifyGroupMembers,
  onCancelEdit,
  onGroupChange,
  onSaved,
  profile,
  selectedDate,
  reload,
  setMessage
}: {
  editingEvent: EventItem | null;
  group: Group;
  groups: Group[];
  notifyGroupMembers: (groupId: string, message: string, metadata?: Record<string, unknown>) => Promise<void>;
  onCancelEdit: () => void;
  onGroupChange: (groupId: string) => void;
  onSaved: (groupId: string, selectedDate: string) => void;
  profile: Profile;
  selectedDate: string;
  reload: WorkspaceReload;
  setMessage: (value: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(selectedDate);
  const [time, setTime] = useState("12:00");
  const [timezone, setTimezone] = useState(profile.preferred_timezone);

  useEffect(() => {
    if (!editingEvent) setDate(selectedDate);
  }, [editingEvent, selectedDate]);
  useEffect(() => {
    if (!editingEvent) return;
    const original = sourceDateTime(editingEvent);
    setTitle(editingEvent.title);
    setDescription(editingEvent.description ?? "");
    setLocation(editingEvent.location ?? "");
    setDate(original.toISODate() ?? selectedDate);
    setTime(original.toFormat("HH:mm"));
    setTimezone(editingEvent.source_timezone);
  }, [editingEvent, selectedDate]);

  async function saveEvent(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !title.trim()) return;
    setMessage("");

    const instant = DateTime.fromISO(`${date}T${time}`, { zone: timezone });
    if (!instant.isValid) {
      setMessage("That date, time, and timezone combination is not valid.");
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      starts_at_utc: instant.toUTC().toISO(),
      source_timezone: timezone
    };

    const { data: savedEvent, error } = editingEvent
      ? await supabase
          .from("events")
          .update({ ...payload, group_id: group.id })
          .eq("id", editingEvent.id)
          .select("*")
          .single()
      : await supabase
          .from("events")
          .insert({
            ...payload,
            group_id: group.id,
            creator_id: profile.id
          })
          .select("*")
          .single();

    if (error) {
      setMessage(`Failed to save calendar event. ${error.message}`);
      return;
    }

    const action = editingEvent ? "updated" : "added";
    const changeSummary = eventChangeSummary(editingEvent, payload);
    const savedLocalDate = DateTime.fromISO(payload.starts_at_utc ?? "", { zone: "utc" })
      .setZone(profile.preferred_timezone)
      .toISODate();
    const eventTime = DateTime.fromISO(payload.starts_at_utc ?? "", { zone: "utc" })
      .setZone(profile.preferred_timezone)
      .toFormat("LLL d, h:mm a");
    await notifyGroupMembers(
      group.id,
      `${profile.display_name} ${action} an event in ${group.name}.`,
      {
        type: "calendar_event",
        action,
        eventId: savedEvent?.id ?? editingEvent?.id,
        eventTitle: payload.title,
        eventDate: savedLocalDate ?? date,
        groupId: group.id,
        summary: editingEvent ? `${payload.title}: ${changeSummary}` : `${payload.title} • Scheduled for ${eventTime}`
      }
    );
    onSaved(group.id, savedLocalDate ?? date);
    setTitle("");
    setDescription("");
    setLocation("");
    onCancelEdit();
    await reload();
    setMessage(`Calendar event ${action} successfully.`);
  }

  const canEdit = group.role === "owner" || group.role === "editor";

  return (
    <section className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/70 bg-white p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#2b2a25] sm:rounded-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {editingEvent ? <Pencil size={18} /> : <Plus size={18} />}
          <h2 className="font-semibold">{editingEvent ? "Edit event" : "Add event"}</h2>
        </div>
        <button aria-label="Close event details" className="grid h-9 w-9 place-items-center rounded-full border border-line dark:border-white/15" onClick={onCancelEdit} type="button">
          <X size={17} />
        </button>
      </div>
      <form className="flex flex-col gap-3" onSubmit={saveEvent}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Group
          <select
            className="rounded-full border border-line bg-white px-3 py-2 text-sm font-normal text-ink outline-none transition focus:border-moss disabled:opacity-50 dark:border-white/15 dark:bg-[#23231f] dark:text-paper"
            value={group.id}
            onChange={(event) => onGroupChange(event.target.value)}
            disabled={!canEdit}
          >
            {groups.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <Field label="Title" value={title} onChange={setTitle} required disabled={!canEdit} />
        <Field label="Location" value={location} onChange={setLocation} disabled={!canEdit} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Description
          <textarea
            className="min-h-20 rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal text-ink outline-none focus:border-moss dark:border-white/15 dark:bg-[#23231f] dark:text-paper"
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
          {canEdit ? (editingEvent ? "Update event" : "Save event") : "Viewer access"}
        </button>
        {editingEvent ? (
          <button
            className="rounded-full border border-line px-4 py-3 font-medium dark:border-white/15"
            onClick={onCancelEdit}
            type="button"
          >
            Cancel edit
          </button>
        ) : null}
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
        className="rounded-full border border-line bg-white px-3 py-2 text-sm font-normal text-ink outline-none transition focus:border-moss disabled:opacity-50 dark:border-white/15 dark:bg-[#23231f] dark:text-paper"
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
  const options = useMemo(() => {
    const browserZones =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : [];
    return [...new Set([value, browserTimezone(), ...timezones, ...browserZones])].filter(Boolean).sort();
  }, [value]);
  const listId = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-zones`;

  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        autoComplete="off"
        className="rounded-full border border-line bg-white px-3 py-2 text-sm font-normal text-ink outline-none transition focus:border-moss disabled:opacity-50 dark:border-white/15 dark:bg-[#23231f] dark:text-paper"
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="Search timezone"
      />
      <datalist id={listId}>
        {options.map((timezone) => (
          <option key={timezone} value={timezone}>
            {timezone}
          </option>
        ))}
      </datalist>
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
    <div className="grid grid-cols-2 rounded-full border border-line bg-paper p-1 dark:border-white/15 dark:bg-[#23231f]">
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
    <div className="rounded-lg border border-line/70 bg-paper px-3 py-2 text-sm dark:border-white/10 dark:bg-[#23231f]">
      <p className="text-xs uppercase tracking-[0.14em] text-ink/45 dark:text-paper/45">{label}</p>
      <p className="mt-1 font-medium">{time}</p>
      <p className="truncate text-xs text-ink/55 dark:text-paper/55">{zone}</p>
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-lg border border-dashed border-rust/40 bg-white/70 p-6 text-center shadow-sm backdrop-blur dark:border-rust/40 dark:bg-[#2b2a25]">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-paper text-rust dark:bg-[#23231f]">
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
        <div className="flex flex-col justify-between rounded-lg border border-line bg-white/95 p-5 shadow-soft dark:border-white/15 dark:bg-[#2b2a25]">
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
    <div className="flex items-center gap-3 rounded-md bg-paper px-3 py-2 dark:bg-[#23231f]">
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
    <section className="overflow-hidden rounded-lg border border-line bg-[#fffaf0]/95 shadow-soft dark:border-white/15 dark:bg-[#2b2a25]">
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
              className="aspect-square bg-[radial-gradient(circle_at_35%_35%,#f4f1ea_0,#c7c3ba_32%,#2b2b29_100%)] dark:bg-[#23231f]"
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
