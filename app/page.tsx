"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Dumbbell,
  Download,
  FileText,
  FolderOpen,
  HeartHandshake,
  Image as ImageIcon,
  Info,
  Link2,
  LogOut,
  MoreHorizontal,
  Moon,
  Plus,
  Pencil,
  Play,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  Square,
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
import type { ProgramSession, WeekDayKey } from "@/lib/companion";

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
  invite_token: string;
  owner_name: string;
  owner_username: string;
  role: "owner" | "editor" | "viewer";
  member_count: number;
};

type GroupMember = {
  groupId: string;
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: "owner" | "editor" | "viewer";
  relationship: ConnectionRelationship;
};

type EventItem = {
  id: string;
  group_id: string | null;
  owner_id?: string | null;
  project_id?: string | null;
  title: string;
  description: string | null;
  location: string | null;
  reference?: string | null;
  location_lat?: number | null;
  location_lon?: number | null;
  location_place_id?: string | null;
  starts_at_utc: string;
  source_timezone: string;
  creator_id: string;
  created_at: string;
  weather_status?: "sunny" | "rain" | null;
  weather_emoji?: string | null;
  weather_checked_at?: string | null;
  weather_next_check_at?: string | null;
  weather_rain_probability?: number | null;
  weather_source?: string | null;
};

type ViewMode = "agenda" | "week" | "month";
type AppTab = "gallery" | "connections" | "groups" | "calendar" | "projects" | "profile";

type ProjectType = "fitness" | "writing" | "audio" | "music";
type ProjectEntryKind = "workout" | "journal" | "draft" | "voice_memo" | "stem" | "lyrics";

type ProjectItem = {
  id: string;
  owner_id: string;
  group_id: string | null;
  name: string;
  type: ProjectType;
  subtype: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  group_name?: string | null;
};

type ProjectEntry = {
  id: string;
  project_id: string;
  owner_id: string;
  kind: ProjectEntryKind;
  title: string;
  body: string | null;
  media_path?: string | null;
  media_url?: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

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

type WorkspaceSnapshot = {
  connectionNotifications: ConnectionNotification[];
  connectionRequests: ConnectionRequest[];
  connections: ConnectionProfile[];
  events: EventItem[];
  groupInvites: GroupInvite[];
  groupMembers: Record<string, GroupMember[]>;
  groupNotifications: GroupNotification[];
  groups: Group[];
  photos: PhotoItem[];
  profile: Profile;
  projects: ProjectItem[];
  savedAt: string;
  version: number;
};

type EventWeather = {
  checkedAt: string;
  emoji: string;
  nextCheckAt: string | null;
  rainProbability: number;
  source: string;
  status: "sunny" | "rain";
};

type LocationSuggestion = {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
  type: string;
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
  groupId: string | null;
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

type ConnectionNotification = {
  id: string;
  actorId: string | null;
  actorName: string;
  actorUsername: string;
  actorAvatarUrl: string;
  message: string;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

type BetaRequest = {
  email: string;
  requestedAt: string;
  approvedAt: string | null;
};

type BetaUser = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
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
  group_id: string | null;
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

type ConnectionNotificationRow = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_username: string | null;
  actor_avatar_url: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
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
const specialLovePhotoId = "4ebe631a-e43a-4eef-a3da-73f328df44eb";
const workspaceCachePrefix = "connection-workspace-cache";
const workspaceLastUserKey = "connection-workspace-last-user";
const workspaceCacheVersion = 1;
const appVersion = "0.1.0";
const betaVersionName = "quiet beta";
const loveHeartParticles = [
  { left: 8, delay: 0.05, duration: 2.8, size: 1.25 },
  { left: 14, delay: 0.45, duration: 3.1, size: 1.7 },
  { left: 21, delay: 0.2, duration: 2.7, size: 1.35 },
  { left: 29, delay: 0.8, duration: 3.3, size: 1.55 },
  { left: 36, delay: 0.1, duration: 2.9, size: 1.9 },
  { left: 43, delay: 0.55, duration: 3.2, size: 1.3 },
  { left: 51, delay: 0.25, duration: 2.8, size: 1.65 },
  { left: 58, delay: 0.7, duration: 3.4, size: 1.4 },
  { left: 66, delay: 0.15, duration: 3, size: 1.85 },
  { left: 73, delay: 0.5, duration: 2.7, size: 1.25 },
  { left: 81, delay: 0.9, duration: 3.2, size: 1.55 },
  { left: 89, delay: 0.3, duration: 2.9, size: 1.75 }
];
type OpenPhoto = (id: string, photos: PhotoItem[]) => void;
type WorkspaceReload = () => void | Promise<void>;
type ShareTarget =
  | { type: "connections" }
  | { type: "group"; groupId: string };

function workspaceCacheKey(userId: string) {
  return `${workspaceCachePrefix}:${workspaceCacheVersion}:${userId}`;
}

function eventHasWeatherPlace(event: Pick<EventItem, "location" | "location_lat" | "location_lon">) {
  return Boolean(
    event.location?.trim() ||
      (event.location_lat !== null &&
        event.location_lat !== undefined &&
        event.location_lon !== null &&
        event.location_lon !== undefined)
  );
}

async function fetchEventWeather({
  fallbackTimezone,
  latitude,
  location,
  longitude,
  startsAtUtc
}: {
  fallbackTimezone?: string | null;
  latitude?: number | null;
  location?: string | null;
  longitude?: number | null;
  startsAtUtc: string | null;
}) {
  if (!startsAtUtc) return null;
  try {
    const response = await fetch("/api/weather", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fallbackTimezone, latitude, location, longitude, startsAtUtc })
    });
    const payload = (await response.json()) as { weather?: EventWeather | null };
    return response.ok ? (payload.weather ?? null) : null;
  } catch {
    return null;
  }
}

function weatherColumns(weather: EventWeather) {
  return {
    weather_checked_at: weather.checkedAt,
    weather_emoji: weather.emoji,
    weather_next_check_at: weather.nextCheckAt,
    weather_rain_probability: weather.rainProbability,
    weather_source: weather.source,
    weather_status: weather.status
  };
}

function groupRoleLabel(role: Group["role"]) {
  return role === "owner" ? "Admin" : "Member";
}

function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
}

function usernameError(value: string) {
  return /^[a-z0-9_]{3,24}$/.test(value)
    ? ""
    : "Username must be 3-24 lowercase letters, numbers, or underscores.";
}

function profileErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === "23505" || error.message?.includes("profiles_username_key")) {
    return "Username is already taken.";
  }
  return error.message ?? "Could not save profile.";
}

function mapConnectionProfile(row: ConnectionProfileRow): ConnectionProfile {
  return {
    id: row.id,
    username: normalizeUsername(row.username),
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
    username: normalizeUsername(row.username),
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

function mapConnectionNotification(row: ConnectionNotificationRow): ConnectionNotification {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name ?? "Someone",
    actorUsername: normalizeUsername(row.actor_username ?? "user"),
    actorAvatarUrl: row.actor_avatar_url ?? "",
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

function referenceHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "#";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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
    event.description || event.reference
      ? `DESCRIPTION:${icsEscape([event.description, event.reference ? `Reference: ${event.reference}` : ""].filter(Boolean).join("\n\n"))}`
      : "",
    event.location ? `LOCATION:${icsEscape(event.location)}` : "",
    event.reference ? `URL:${icsEscape(referenceHref(event.reference))}` : "",
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

function calendarEventIcs(event: EventItem) {
  const start = DateTime.fromISO(event.starts_at_utc, { zone: "utc" });
  const end = start.plus({ hours: 1 });
  return [
    "BEGIN:VEVENT",
    `UID:${event.id}@connection`,
    `DTSTAMP:${DateTime.utc().toFormat("yyyyLLdd'T'HHmmss'Z'")}`,
    `DTSTART:${icsDate(event.starts_at_utc)}`,
    `DTEND:${end.toFormat("yyyyLLdd'T'HHmmss'Z'")}`,
    `SUMMARY:${icsEscape(event.title)}`,
    event.description || event.reference
      ? `DESCRIPTION:${icsEscape([event.description, event.reference ? `Reference: ${event.reference}` : ""].filter(Boolean).join("\n\n"))}`
      : "",
    event.location ? `LOCATION:${icsEscape(event.location)}` : "",
    event.reference ? `URL:${icsEscape(referenceHref(event.reference))}` : "",
    "END:VEVENT"
  ].filter(Boolean).join("\r\n");
}

function downloadCalendarIcs(events: EventItem[], label: string) {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Connection//Calendar Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events.map(calendarEventIcs),
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(label || "connection-calendar")}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slugify(value: string) {
  return value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "connection";
}

function pdfEscape(value = "") {
  return value
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapPdfText(value: string, maxChars: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

type PdfLine = {
  text: string;
  size?: number;
  bold?: boolean;
  gap?: number;
  kind?: "pill";
  maxChars?: number;
};

function buildSimplePdf(lines: PdfLine[]) {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const pages: string[] = [];
  let y = pageHeight - margin;
  let content = "";

  function pushPage() {
    pages.push(content);
    content = "";
    y = pageHeight - margin;
  }

  for (const line of lines) {
    const size = line.size ?? 11;
    const gap = line.gap ?? Math.ceil(size * 1.45);
    const wrappedLines = line.maxChars ? wrapPdfText(line.text, line.maxChars) : [line.text];
    if (line.kind === "pill") {
      const lineHeight = Math.ceil(size * 1.35);
      const pillHeight = 16 + wrappedLines.length * lineHeight;
      if (y < margin + pillHeight + 8) pushPage();
      content += `q 0.90 0.93 0.86 rg ${margin} ${y - pillHeight + 7} ${contentWidth} ${pillHeight} re f Q\n`;
      wrappedLines.forEach((text, index) => {
        content += `BT /F2 ${size} Tf ${margin} ${y - 12 - index * lineHeight} Td (${pdfEscape(text)}) Tj ET\n`;
      });
      y -= pillHeight + 12;
    } else {
      const lineHeight = Math.ceil(size * 1.35);
      if (y < margin + wrappedLines.length * lineHeight) pushPage();
      wrappedLines.forEach((text, index) => {
        content += `BT /${line.bold ? "F2" : "F1"} ${size} Tf ${margin} ${y - index * lineHeight} Td (${pdfEscape(text)}) Tj ET\n`;
      });
      y -= wrappedLines.length > 1 ? wrappedLines.length * lineHeight + 4 : gap;
    }
  }
  pushPage();

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  ];

  pages.forEach((page, index) => {
    const contentObjectId = 6 + index * 2;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>`);
    objects.push(`<< /Length ${page.length} >>\nstream\n${page}endstream`);
  });

  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return body;
}

function downloadCalendarPdf({
  events,
  groups,
  label,
  profile,
  rangeLabel,
  timezone
}: {
  events: EventItem[];
  groups: Group[];
  label: string;
  profile: Profile;
  rangeLabel: string;
  timezone: string;
}) {
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const lines: PdfLine[] = [
    { text: "Connection", size: 24, bold: true, gap: 30 },
    { text: `@${profile.username} calendar export`, size: 12, gap: 18 },
    { text: `Selection: ${label}`, size: 12, gap: 18 },
    { text: `Range: ${rangeLabel}`, size: 12, gap: 18 },
    { text: `Generated: ${DateTime.now().setZone(timezone).toFormat("LLL d, yyyy h:mm a ZZZZ")}`, size: 10, gap: 28 },
    { text: events.length ? `${events.length} event${events.length === 1 ? "" : "s"}` : "No events in this selection", size: 14, bold: true, gap: 24 }
  ];

  events
    .slice()
    .sort((first, second) => DateTime.fromISO(first.starts_at_utc).toMillis() - DateTime.fromISO(second.starts_at_utc).toMillis())
    .forEach((event) => {
      const local = localDateTime(event, timezone);
      const entered = sourceDateTime(event);
      lines.push({
        text: `${event.title} - ${local.toFormat("ccc, LLL d, yyyy h:mm a")}`,
        size: 12,
        bold: true,
        gap: 36,
        kind: "pill",
        maxChars: 72
      });
      lines.push({ text: `Group: ${event.group_id ? groupNames.get(event.group_id) ?? "Group" : "Personal"}`, size: 11, gap: 16, maxChars: 84 });
      lines.push({ text: `Your time: ${local.toFormat("ccc, LLL d, yyyy h:mm a")} (${timezone})`, size: 11, gap: 16, maxChars: 84 });
      if (event.location) lines.push({ text: `Location: ${event.location}`, size: 11, gap: 16, maxChars: 84 });
      if (event.reference) lines.push({ text: `Reference: ${referenceHref(event.reference)}`, size: 11, gap: 16, maxChars: 84 });
      lines.push({ text: `Entered as: ${entered.toFormat("ccc, LLL d, yyyy h:mm a")} (${event.source_timezone})`, size: 10, gap: 16, maxChars: 92 });
      if (event.description) {
        wrapPdfText(event.description, 78).forEach((line) => lines.push({ text: line, size: 11, gap: 15 }));
      }
      lines.push({ text: " ", gap: 18 });
    });

  const blob = new Blob([buildSimplePdf(lines)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(label || "connection-calendar")}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openGoogleCalendar(event: EventItem) {
  const start = DateTime.fromISO(event.starts_at_utc, { zone: "utc" });
  const end = start.plus({ hours: 1 });
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start.toFormat("yyyyLLdd'T'HHmmss'Z'")}/${end.toFormat("yyyyLLdd'T'HHmmss'Z'")}`,
    details: [event.description, event.reference ? `Reference: ${event.reference}` : ""].filter(Boolean).join("\n\n"),
    location: event.location ?? ""
  });
  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, "_blank", "noopener,noreferrer");
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

function groupNotificationSummary(notification: GroupNotification, timezone: string) {
  if (
    notification.metadata.type === "calendar_event" &&
    notification.metadata.action === "added" &&
    typeof notification.metadata.eventTitle === "string" &&
    typeof notification.metadata.startsAtUtc === "string"
  ) {
    const localTime = DateTime.fromISO(notification.metadata.startsAtUtc, { zone: "utc" }).setZone(timezone);
    if (localTime.isValid) {
      return `${notification.metadata.eventTitle} • Scheduled for ${localTime.toFormat("LLL d, h:mm a")}`;
    }
  }

  return typeof notification.metadata.summary === "string" ? notification.metadata.summary : null;
}

function calendarNotificationStyle(notification: GroupNotification) {
  if (notification.metadata.type !== "calendar_event") {
    return {
      card: "",
      summary: "bg-white text-ink/55 dark:bg-[#242420] dark:text-paper/55"
    };
  }

  if (notification.metadata.action === "deleted") {
    return {
      card: "",
      summary:
        "border border-red-500/15 bg-red-500/[0.07] text-red-700 dark:border-red-300/10 dark:bg-red-300/[0.08] dark:text-red-200"
    };
  }

  if (notification.metadata.action === "updated") {
    return {
      card: "",
      summary:
        "border border-sky-500/15 bg-sky-500/[0.07] text-sky-700 dark:border-sky-300/10 dark:bg-sky-300/[0.08] dark:text-sky-200"
    };
  }

  if (notification.metadata.action === "added") {
    return {
      card: "",
      summary:
        "border border-emerald-500/15 bg-emerald-500/[0.07] text-emerald-800 dark:border-emerald-300/10 dark:bg-emerald-300/[0.08] dark:text-emerald-200"
    };
  }

  return {
    card: "",
    summary: "bg-white text-ink/55 dark:bg-[#242420] dark:text-paper/55"
  };
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
  reference: string | null;
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

  if ((previousEvent.reference ?? "") !== (nextEvent.reference ?? "")) {
    changes.push("Reference changed");
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
    input.focus();
    input.select();
    input.setSelectionRange(0, input.value.length);
    const copied = document.execCommand("copy");
    document.body.removeChild(input);
    return copied;
  }
}

async function shareOrCopyLink(url: string) {
  const copied = await copyText(url);
  if (copied) return true;

  if (navigator.share) {
    try {
      await navigator.share({ title: "Connection photo", url });
      return true;
    } catch {
      return false;
    }
  }

  return false;
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
  const [groupMembers, setGroupMembers] = useState<Record<string, GroupMember[]>>({});
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([]);
  const [groupNotifications, setGroupNotifications] = useState<GroupNotification[]>([]);
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);
  const [connectionNotifications, setConnectionNotifications] = useState<ConnectionNotification[]>([]);
  const [connections, setConnections] = useState<ConnectionProfile[]>([]);
  const [connectionSearchResults, setConnectionSearchResults] = useState<ConnectionProfile[]>([]);
  const [connectionQuery, setConnectionQuery] = useState("");
  const [cachedUserId, setCachedUserId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(workspaceLastUserKey);
  });
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedConnectionProfile, setSelectedConnectionProfile] = useState<ConnectionProfile | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [viewerWeatherByEventId, setViewerWeatherByEventId] = useState<Record<string, EventWeather>>({});
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("connections");
  const [calendarGroupId, setCalendarGroupId] = useState("all");
  const [projectsScopeId, setProjectsScopeId] = useState("personal");
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
  const [profileChecked, setProfileChecked] = useState(false);
  const [message, setMessage] = useState("");
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("connection-dark-mode") !== "false";
  });
  const [accountOpen, setAccountOpen] = useState(false);
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<InvitePreview | null>(null);
  const [workoutLogEventId, setWorkoutLogEventId] = useState<string | null>(null);
  const [workoutLogEntries, setWorkoutLogEntries] = useState<{ id: string; project_id: string; metadata: Record<string, unknown> }[]>([]);
  const notificationAreaRef = useRef<HTMLDivElement | null>(null);
  const pullStartRef = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("connection-dark-mode", String(darkMode));
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
    if (!message) return;
    const timeout = window.setTimeout(() => {
      setMessage((currentMessage) => (currentMessage === message ? "" : currentMessage));
    }, 3500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (!notificationsOpen) return;
    setNotificationsOpen(false);
  }, [activeGroupId, activeTab, pendingCaptureSrc, selectedConnectionId, selectedPhotoId]);

  useEffect(() => {
    if (!aboutOpen) return;
    setAboutOpen(false);
  }, [activeGroupId, activeTab, pendingCaptureSrc, selectedConnectionId, selectedPhotoId]);

  useEffect(() => {
    if (activeTab === "connections") return;
    setHeaderSearchOpen(false);
    setConnectionQuery("");
    setConnectionSearchResults([]);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "connections" || !headerSearchOpen || selectedConnectionId) return;
    const timeout = window.setTimeout(() => {
      void searchConnections(connectionQuery);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [activeTab, connectionQuery, headerSearchOpen, selectedConnectionId]);

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
    if (!notificationsOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [notificationsOpen]);

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
    if (sessionUserId || !cachedUserId) return;
    restoreWorkspaceCache(cachedUserId);
  }, [cachedUserId, sessionUserId]);

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
      const authType = hashParams.get("type");

      if (accessToken && refreshToken) {
        setNeedsPasswordSetup(authType === "invite");
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
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearWorkspaceCache(sessionUserId ?? cachedUserId);
      }
      setSessionUserId(session?.user.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionUserId) {
      setProfileChecked(false);
      setProfile(null);
      setGroups([]);
      setGroupMembers({});
      setGroupInvites([]);
      setGroupNotifications([]);
      setConnectionRequests([]);
      setConnectionNotifications([]);
      setConnections([]);
      setConnectionSearchResults([]);
      setConnectionQuery("");
      setSelectedConnectionId(null);
      setSelectedConnectionProfile(null);
      setEvents([]);
      setViewerWeatherByEventId({});
      setPhotos([]);
      setProjects([]);
      return;
    }

    setProfileChecked(false);
    setAccountOpen(false);
    setAboutOpen(false);
    setHeaderSearchOpen(false);
    setNotificationsOpen(false);
    setActiveGroupId(null);
    setActiveTab("connections");
    setSelectedPhotoId(null);
    setPendingCaptureSrc(null);
    setSelectedConnectionId(null);
    setSelectedConnectionProfile(null);
    restoreWorkspaceCache(sessionUserId);
    void loadWorkspace(sessionUserId);
  }, [sessionUserId]);

  useEffect(() => {
    if (!sessionUserId || !profile) return;
    void preparePendingInvitePrompt();
  }, [sessionUserId, profile]);

  useEffect(() => {
    if (!sessionUserId || !profile) return;
    const timeout = window.setTimeout(() => {
      const snapshot: WorkspaceSnapshot = {
        connectionNotifications,
        connectionRequests,
        connections,
        events,
        groupInvites,
        groupMembers,
        groupNotifications,
        groups,
        photos,
        profile,
        projects,
        savedAt: new Date().toISOString(),
        version: workspaceCacheVersion
      };
      localStorage.setItem(workspaceCacheKey(sessionUserId), JSON.stringify(snapshot));
      localStorage.setItem(workspaceLastUserKey, sessionUserId);
      setCachedUserId(sessionUserId);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [
    connectionNotifications,
    connectionRequests,
    connections,
    events,
    groupInvites,
    groupMembers,
    groupNotifications,
    groups,
    photos,
    profile,
    projects,
    sessionUserId
  ]);

  function restoreWorkspaceCache(userId: string) {
    try {
      const cached = localStorage.getItem(workspaceCacheKey(userId));
      if (!cached) return;
      const snapshot = JSON.parse(cached) as Partial<WorkspaceSnapshot>;
      if (snapshot.version !== workspaceCacheVersion || !snapshot.profile) return;

      setProfile(snapshot.profile);
      setGroups(snapshot.groups ?? []);
      setGroupMembers(snapshot.groupMembers ?? {});
      setGroupInvites(snapshot.groupInvites ?? []);
      setGroupNotifications(snapshot.groupNotifications ?? []);
      setConnectionRequests(snapshot.connectionRequests ?? []);
      setConnectionNotifications(snapshot.connectionNotifications ?? []);
      setConnections(snapshot.connections ?? []);
      setEvents(snapshot.events ?? []);
      setPhotos(snapshot.photos ?? []);
      setProjects(snapshot.projects ?? []);
      setLoading(false);
      setProfileChecked(true);
    } catch {
      localStorage.removeItem(workspaceCacheKey(userId));
    }
  }

  function clearWorkspaceCache(userId?: string | null) {
    const cachedId = userId ?? localStorage.getItem(workspaceLastUserKey);
    if (cachedId) localStorage.removeItem(workspaceCacheKey(cachedId));
    localStorage.removeItem(workspaceLastUserKey);
    setCachedUserId(null);
    setProfile(null);
    setGroups([]);
    setGroupMembers({});
    setGroupInvites([]);
    setGroupNotifications([]);
    setConnectionRequests([]);
    setConnectionNotifications([]);
    setConnections([]);
    setConnectionSearchResults([]);
    setConnectionQuery("");
    setSelectedConnectionId(null);
    setSelectedConnectionProfile(null);
    setEvents([]);
    setViewerWeatherByEventId({});
    setPhotos([]);
    setProjects([]);
    setProfileChecked(false);
  }

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
    setProfile(profileData ? { ...profileData, username: normalizeUsername(profileData.username) } : null);
    setProfileChecked(true);

    const { data: membershipData, error: membershipError } = await supabase
      .from("group_members")
      .select("role, groups(id, name, owner_id, invite_token, profiles!groups_owner_id_fkey(username, display_name))")
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
                invite_token: group.invite_token,
                owner_name: ownerProfile?.display_name ?? ownerProfile?.username ?? "Admin",
                owner_username: normalizeUsername(ownerProfile?.username ?? "admin"),
                role: membership.role,
                member_count: 1
              } as Group
            ]
          : [];
      }) ?? [];

    if (loadedGroups.length) {
      const { data: allMemberRows, error: memberCountError } = await supabase
        .from("group_members")
        .select("group_id, user_id, role, profiles!group_members_user_id_fkey(username, display_name, avatar_url)")
        .in(
          "group_id",
          loadedGroups.map((group) => group.id)
        );

      if (memberCountError) {
        setMessage(memberCountError.message);
      } else {
        const memberCounts = new Map<string, number>();
        const membersByGroup: Record<string, GroupMember[]> = {};
        allMemberRows?.forEach((member) => {
          memberCounts.set(member.group_id, (memberCounts.get(member.group_id) ?? 0) + 1);
          const memberProfile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
          if (!memberProfile) return;
          const groupMembers = membersByGroup[member.group_id] ?? [];
          groupMembers.push({
            groupId: member.group_id,
            id: member.user_id,
            username: normalizeUsername(memberProfile.username ?? "user"),
            displayName: memberProfile.display_name ?? memberProfile.username ?? "Member",
            avatarUrl: memberProfile.avatar_url ?? "",
            role: member.role,
            relationship: member.user_id === userId ? "self" : "none"
          });
          membersByGroup[member.group_id] = groupMembers;
        });
        loadedGroups.forEach((group) => {
          group.member_count = memberCounts.get(group.id) ?? 1;
        });
        setGroupMembers(membersByGroup);
      }
    } else {
      setGroupMembers({});
    }

    setGroups(loadedGroups);
    setActiveGroupId((currentGroupId) =>
      currentGroupId && loadedGroups.some((group) => group.id === currentGroupId) ? currentGroupId : null
    );
    setCalendarGroupId((currentGroupId) =>
      currentGroupId === "all" || currentGroupId === "personal" || loadedGroups.some((group) => group.id === currentGroupId)
        ? currentGroupId
        : "all"
    );

    const loadedEvents: EventItem[] = [];
    const { data: personalEventData, error: personalEventError } = await supabase
      .from("events")
      .select("*")
      .is("group_id", null)
      .order("starts_at_utc", { ascending: true });

    if (personalEventError) setMessage(personalEventError.message);
    loadedEvents.push(...((personalEventData ?? []) as EventItem[]));

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
      loadedEvents.push(...((eventData ?? []) as EventItem[]));
    }

    const eventsById = new Map(loadedEvents.map((event) => [event.id, event]));
    const sortedEvents = Array.from(eventsById.values()).sort(
      (first, second) => DateTime.fromISO(first.starts_at_utc).toMillis() - DateTime.fromISO(second.starts_at_utc).toMillis()
    );
    setEvents(sortedEvents);

    const { data: workoutEntryRows } = await supabase.from("project_entries").select("id, project_id, metadata").eq("kind", "workout");
    setWorkoutLogEntries(workoutEntryRows ?? []);

    // TODO: refreshDueEventWeather fires on every loadWorkspace() call (project saves, program creation,
    // workout logs, pull-to-refresh, etc. all call reload()), each doing up to 5 external weather lookups.
    // That's too heavy for how often reload() now runs. Disabled until there's a cheaper trigger for this
    // (e.g. a server-side cron instead of a client-side check on every reload, or a much longer interval).
    // void refreshDueEventWeather(sortedEvents, profileData?.preferred_timezone ?? profile?.preferred_timezone);

    await loadPhotos();
    await loadProjects();
    await loadGroupInvites(userId);
    await loadGroupNotifications();
    await loadConnections();
    await loadConnectionNotifications();
    await loadConnectionRequests();

    setLoading(false);
  }

  async function refreshDueEventWeather(eventRows: EventItem[], viewerTimezone = profile?.preferred_timezone) {
    if (!supabase) return;
    const now = DateTime.utc();
    const dueEvents = eventRows
      .filter((event) => {
        const hasWeatherPlace = eventHasWeatherPlace(event);
        if (!hasWeatherPlace && !viewerTimezone) return false;
        const eventTime = DateTime.fromISO(event.starts_at_utc, { zone: "utc" });
        if (!eventTime.isValid || eventTime <= now) return false;
        const localWeather = viewerWeatherByEventId[event.id];
        const checkedAt = hasWeatherPlace ? event.weather_checked_at : localWeather?.checkedAt;
        const nextCheckAt = hasWeatherPlace ? event.weather_next_check_at : localWeather?.nextCheckAt;
        if (!checkedAt) return true;
        if (!nextCheckAt) return false;
        return DateTime.fromISO(nextCheckAt, { zone: "utc" }) <= now;
      })
      .slice(0, 5);

    for (const event of dueEvents) {
      const hasWeatherPlace = eventHasWeatherPlace(event);
      const weather = await fetchEventWeather({
        fallbackTimezone: hasWeatherPlace ? event.source_timezone : viewerTimezone,
        latitude: event.location_lat,
        location: event.location,
        longitude: event.location_lon,
        startsAtUtc: event.starts_at_utc
      });
      if (!weather) continue;
      const columns = weatherColumns(weather);
      if (!hasWeatherPlace) {
        setViewerWeatherByEventId((currentWeather) => ({ ...currentWeather, [event.id]: weather }));
        continue;
      }
      const { error } = await supabase.from("events").update(columns).eq("id", event.id);
      if (!error) {
        setEvents((currentEvents) =>
          currentEvents.map((item) => (item.id === event.id ? { ...item, ...columns } : item))
        );
      }
    }
  }

  async function refreshWorkspace() {
    if (!sessionUserId || refreshing) return;
    setRefreshing(true);
    try {
      await loadWorkspace(sessionUserId, { clearMessage: false });
    } finally {
      setRefreshing(false);
    }
  }

  async function loadGroupInvites(userId = sessionUserId) {
    if (!supabase || !userId) return;

    const { data, error } = await supabase.rpc("pending_group_invites");

    if (error) {
      setMessage(profileErrorMessage(error));
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

  async function loadConnectionNotifications() {
    if (!supabase) return;

    const { data, error } = await supabase.rpc("pending_connection_notifications");

    if (error) {
      setMessage(error.message);
      return;
    }

    setConnectionNotifications(((data ?? []) as ConnectionNotificationRow[]).map(mapConnectionNotification));
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

  async function markConnectionNotificationRead(notificationId: string) {
    if (!supabase) return;

    const { error } = await supabase.rpc("mark_connection_notification_read", {
      notification_id: notificationId
    });

    if (error) {
      setMessage(`Failed to update notification. ${error.message}`);
      return;
    }

    setConnectionNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, readAt: new Date().toISOString() } : notification
      )
    );
  }

  async function clearUnreadNotifications() {
    if (!supabase) return;
    const unreadGroups = groupNotifications.filter((notification) => !notification.readAt);
    const unreadConnections = connectionNotifications.filter((notification) => !notification.readAt);
    if (!unreadGroups.length && !unreadConnections.length) return;

    setMessage("");
    const results = await Promise.all([
      ...unreadGroups.map((notification) =>
        supabase.rpc("mark_group_notification_read", {
          notification_id: notification.id
        })
      ),
      ...unreadConnections.map((notification) =>
        supabase.rpc("mark_connection_notification_read", {
          notification_id: notification.id
        })
      )
    ]);
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setMessage(`Failed to clear notifications. ${failed.error.message}`);
      return;
    }

    const readAt = new Date().toISOString();
    setGroupNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt ?? readAt })));
    setConnectionNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt ?? readAt })));
  }

  async function openConnectionNotification(notification: ConnectionNotification) {
    if (!notification.readAt) {
      await markConnectionNotificationRead(notification.id);
    }

    setNotificationsOpen(false);
    const profileId =
      typeof notification.metadata.profileId === "string" ? notification.metadata.profileId : notification.actorId;
    if (!profileId) return;
    setSelectedConnectionProfile(null);
    setSelectedConnectionId(profileId);
    setActiveTab("connections");
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
      if (!groupId) {
        setActiveTab("calendar");
        return;
      }
      setCalendarGroupId(groupId);
      if (eventDate) setSelectedDate(eventDate);
      if (eventId && action !== "deleted") setView("agenda");
      setActiveTab("calendar");
      return;
    }

    if (action === "group_deleted" || !groupId) {
      setActiveGroupId(null);
      setActiveTab("groups");
      return;
    }

    setActiveGroupId(groupId);
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
    setSelectedConnectionProfile((current) =>
      current?.id === targetUserId ? { ...current, relationship: "pending_sent" } : current
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
    setSelectedConnectionProfile(null);
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

  async function authHeaders(options: { refresh?: boolean } = {}) {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    let session = data.session;
    if (options.refresh && session) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      session = refreshed.session ?? session;
    }
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : null;
  }

  async function resetWorkoutLog(event: EventItem) {
    if (!supabase) return;
    const entry = workoutLogEntries.find(
      (row) => row.project_id === event.project_id && (row.metadata as { loggedFromEventId?: string })?.loggedFromEventId === event.id
    );
    if (!entry) return;
    const confirmed = window.confirm(`"${event.title}" is already logged. Reset it so you can log it again?`);
    if (!confirmed) return;
    const { error } = await supabase.from("project_entries").delete().eq("id", entry.id);
    if (error) {
      setMessage(`Could not reset. ${error.message}`);
      return;
    }
    await loadWorkspace();
    setMessage("Workout reset.");
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

  async function loadProjects() {
    const headers = await authHeaders();
    if (!headers) return;

    const response = await fetch("/api/projects", { headers });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(payload.error ?? "Could not load projects.");
      return;
    }

    setProjects(payload.projects ?? []);
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
      await notifyGroupMembers(
        target.groupId,
        `${profile.display_name} posted a photo${group ? ` in ${group.name}` : ""}.`,
        {
          type: "group_photo",
          action: "posted",
          photoId: payload.photo.id,
          groupId: target.groupId,
          summary: caption.trim() || "New photo shared"
        }
      );
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
    if (photo.groupId && profile) {
      await notifyGroupMembers(photo.groupId, `${profile.display_name} deleted a photo from ${photo.group}.`, {
        type: "group_photo",
        action: "deleted",
        photoId: photo.id,
        groupId: photo.groupId,
        summary: "Photo deleted"
      });
    }
    setMessage("Photo deleted successfully.");
  }

  async function updatePhotoCaption(photo: PhotoItem, caption: string) {
    const headers = await authHeaders();
    if (!headers) {
      setMessage("Please sign in again to edit captions.");
      return false;
    }

    const response = await fetch(`/api/photos/${photo.id}`, {
      method: "PATCH",
      headers: {
        ...headers,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: photo.title,
        caption: caption.trim(),
        location: photo.location,
        tags: photo.tags
      })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(`Failed to update caption. ${payload.error ?? "Please try again."}`);
      return false;
    }

    setPhotos((currentPhotos) =>
      currentPhotos.map((item) => (item.id === photo.id ? { ...item, caption: caption.trim() } : item))
    );
    setMessage("Caption saved.");
    return true;
  }

  async function copyPhotoShareLink(photo: PhotoItem) {
    const headers = await authHeaders({ refresh: true });
    if (!headers) return;

    let response = await fetch(`/api/photos/${photo.id}/share`, {
      method: "POST",
      headers
    });
    let payload = await response.json();

    if (response.status === 401) {
      const refreshedHeaders = await authHeaders({ refresh: true });
      if (refreshedHeaders) {
        response = await fetch(`/api/photos/${photo.id}/share`, {
          method: "POST",
          headers: refreshedHeaders
        });
        payload = await response.json();
      }
    }

    if (!response.ok || !payload.url) {
      setMessage(`Could not create share link. ${payload.error ?? "Please try again."}`);
      return;
    }

    const shared = await shareOrCopyLink(payload.url);
    setMessage(shared ? "Photo share link copied." : "Could not copy share link. Try again.");
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
  const personalEvents = profile
    ? events.filter((event) => !event.group_id && (event.owner_id ?? event.creator_id) === profile.id)
    : [];
  const calendarEvents =
    calendarGroupId === "all"
      ? events
      : calendarGroupId === "personal"
        ? personalEvents
        : events.filter((event) => event.group_id === calendarGroupId);
  const calendarGroup = groups.find((group) => group.id === calendarGroupId) ?? null;
  const loggedWorkoutEventIds = new Set(
    workoutLogEntries
      .map((row) => (row.metadata as { loggedFromEventId?: string })?.loggedFromEventId)
      .filter((id): id is string => Boolean(id))
  );
  const unreadGroupNotifications = groupNotifications.filter((notification) => !notification.readAt);
  const unreadConnectionNotifications = connectionNotifications.filter((notification) => !notification.readAt);
  const notificationCount =
    groupInvites.length + connectionRequests.length + unreadGroupNotifications.length + unreadConnectionNotifications.length;
  const selectedConnection =
    connections.find((connection) => connection.id === selectedConnectionId) ??
    (selectedConnectionProfile?.id === selectedConnectionId ? selectedConnectionProfile : null);
  const selectedDayEvents = useMemo(() => {
    return calendarEvents.filter((event) => localDateTime(event, preferredTimezone).toISODate() === selectedDate);
  }, [calendarEvents, preferredTimezone, selectedDate]);
  const pullProgress = Math.min(1, pullDistance / 72);
  const pullRefreshLabel = refreshing ? "Refreshing" : pullProgress >= 1 ? "Release" : "Pull to refresh";
  const visibleUserId = sessionUserId ?? (loading && profile ? cachedUserId : null);

  if (!hasSupabaseConfig) {
    return <ConfigScreen />;
  }

  if (loading && !visibleUserId) {
    return <ShellStatus label="Opening" />;
  }

  if (!visibleUserId) {
    return <AuthScreen setMessage={setMessage} message={message} />;
  }

  if (!profile && !profileChecked) {
    return <ShellStatus label="Opening" />;
  }

  if (!profile) {
    return (
      <ProfileSetup
        userId={visibleUserId}
        setMessage={setMessage}
        message={message}
        needsPasswordSetup={needsPasswordSetup}
        onComplete={() => {
          setNeedsPasswordSetup(false);
          void loadWorkspace(visibleUserId);
        }}
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
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink/[0.08] py-1.5 dark:border-paper/[0.12]">
          <div className="flex w-20 items-center gap-0.5">
            <label
              aria-label="Open camera"
              className="grid h-8 w-8 cursor-pointer place-items-center text-ink transition hover:-translate-y-0.5 dark:text-paper"
            >
              <Plus size={22} strokeWidth={1.8} />
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
            {activeTab === "connections" && !selectedConnectionId ? (
              <button
                aria-label="Search"
                className="grid h-8 w-8 place-items-center text-ink transition hover:-translate-y-0.5 dark:text-paper"
                onClick={() => {
                  setAboutOpen(false);
                  setAccountOpen(false);
                  setNotificationsOpen(false);
                  setHeaderSearchOpen(true);
                }}
                type="button"
              >
                <Search size={17} strokeWidth={1.8} />
              </button>
            ) : null}
          </div>
          <button
            aria-label="About Connection beta"
            className="absolute left-1/2 -translate-x-1/2 rounded-md px-2 py-1 transition hover:bg-ink/[0.04] dark:hover:bg-paper/[0.06]"
            onClick={() => {
              setAccountOpen(false);
              setNotificationsOpen(false);
              setHeaderSearchOpen(false);
              setAboutOpen((value) => !value);
            }}
            type="button"
          >
            <span className="flex items-center justify-center gap-1.5 whitespace-nowrap">
              <ConnectionLogo compact />
              <span className="inline-flex translate-y-px items-center gap-1 rounded-full bg-skysoft px-2 py-0.5 text-[0.55rem] font-bold uppercase leading-none tracking-[0.08em] text-ink shadow-sm ring-1 ring-white/70 dark:bg-[#d8f4ff] dark:text-[#1d2b34] dark:ring-black/40">
                beta
                <Info size={9} strokeWidth={2.4} />
              </span>
            </span>
          </button>
          <div ref={notificationAreaRef} className="relative flex w-20 items-center justify-end gap-1">
            <button
              aria-label="Notifications"
              className="relative grid h-8 w-8 place-items-center text-ink transition hover:-translate-y-0.5 dark:text-paper"
              onClick={() => {
                setAboutOpen(false);
                setAccountOpen(false);
                if (!notificationsOpen) {
                  void loadGroupNotifications();
                  void loadGroupInvites(sessionUserId);
                  void loadConnectionNotifications();
                  void loadConnectionRequests();
                }
                setNotificationsOpen((value) => !value);
              }}
              type="button"
            >
              <Bell size={15.5} />
              {notificationCount ? (
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-rust" />
              ) : null}
            </button>
            {notificationsOpen ? (
              <NotificationCenter
                connectionNotifications={connectionNotifications}
                connectionRequests={connectionRequests}
                groupNotifications={groupNotifications}
                invites={groupInvites}
                onAcceptConnection={(requesterId) => void acceptConnectionRequest(requesterId)}
                onAcceptGroup={(token) => void acceptInvite(token)}
                onDeclineConnection={(requesterId) => void declineConnectionRequest(requesterId)}
                onDeclineGroup={(token) => void declineInvite(token)}
                onClearAll={() => void clearUnreadNotifications()}
                onOpenConnectionNotification={(notification) => void openConnectionNotification(notification)}
                onOpenGroupNotification={(notification) => void openGroupNotification(notification)}
                timezone={profile.preferred_timezone}
              />
            ) : null}
          </div>
        </header>

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

        {aboutOpen ? (
          <AboutConnectionModal
            onClose={() => setAboutOpen(false)}
            onCopyBetaLink={async () => {
              const copied = await copyText(appUrl("/"));
              setMessage(copied ? "Beta link copied." : "Could not copy beta link. Try again.");
            }}
          />
        ) : null}

        {activeTab === "connections" && headerSearchOpen && !selectedConnectionId ? (
          <ConnectionSearchModal
            query={connectionQuery}
            results={connectionSearchResults}
            setQuery={setConnectionQuery}
            onClose={() => {
              setHeaderSearchOpen(false);
              setConnectionQuery("");
              setConnectionSearchResults([]);
            }}
            onOpenProfile={(profileResult) => {
              setHeaderSearchOpen(false);
              setConnectionQuery("");
              setConnectionSearchResults([]);
              setSelectedConnectionProfile(profileResult);
              setSelectedConnectionId(profileResult.id);
            }}
            onSendRequest={(profileId) => void sendConnectionRequest(profileId)}
          />
        ) : null}

        {message ? (
          <div className="fixed left-1/2 top-5 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-full border border-line bg-white px-4 py-3 text-center text-sm font-medium text-ink shadow-soft dark:border-white/15 dark:bg-[#242420] dark:text-paper">
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
            selectedConnection={selectedConnection}
            onBack={() => {
              setSelectedConnectionId(null);
              setSelectedConnectionProfile(null);
            }}
            onOpenProfile={(profileId) => {
              if (profileId === profile.id) {
                setSelectedConnectionId(null);
                setSelectedConnectionProfile(null);
                setActiveTab("profile");
                return;
              }
              setSelectedConnectionId(profileId);
              setSelectedConnectionProfile(null);
            }}
            onRemoveConnection={(profileId) => void removeConnection(profileId)}
            onSendRequest={(profileId) => void sendConnectionRequest(profileId)}
          />
        ) : null}

        {activeTab === "groups" ? (
          <GroupsView
            activeGroup={activeGroup}
            activeGroupId={activeGroupId}
            groupMembers={groupMembers}
            groups={groups}
            notifyGroupMembers={notifyGroupMembers}
            onOpenGroupCalendar={(groupId) => {
              setActiveGroupId(null);
              setCalendarGroupId(groupId);
              setActiveTab("calendar");
            }}
            onOpenGroupProjects={(groupId) => {
              setActiveGroupId(null);
              setProjectsScopeId(groupId);
              setActiveTab("projects");
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
            allEvents={events}
            calendarGroup={calendarGroup}
            calendarGroupId={calendarGroupId}
            eventToOpenId={calendarEventToOpenId}
            events={calendarEvents}
            groups={groups}
            loggedWorkoutEventIds={loggedWorkoutEventIds}
            onOpenWorkoutLog={(eventId) => setWorkoutLogEventId(eventId)}
            onResetWorkout={resetWorkoutLog}
            profile={profile}
            projects={projects}
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
            viewerWeatherByEventId={viewerWeatherByEventId}
            view={view}
          />
        ) : null}

        {activeTab === "projects" ? (
          <ProjectsView
            dashboardScope={projectsScopeId}
            setDashboardScope={setProjectsScopeId}
            events={events}
            getAuthHeaders={authHeaders}
            groups={groups}
            onOpenWorkoutLog={(eventId) => setWorkoutLogEventId(eventId)}
            profile={profile}
            projects={projects}
            reload={() => loadWorkspace()}
            reloadProjects={loadProjects}
            setActiveTab={setActiveTab}
            setCalendarGroupId={setCalendarGroupId}
            setMessage={setMessage}
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
            onOpenSettings={() => {
              setNotificationsOpen(false);
              setAccountOpen(true);
            }}
          />
        ) : null}
      </div>

      <BottomNav
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === "connections" && activeTab === "connections") {
            setSelectedConnectionId(null);
            setSelectedConnectionProfile(null);
          }
          if (tab === "groups" && activeTab === "groups") {
            setActiveGroupId(null);
          }
          if (tab === "calendar") {
            setCalendarGroupId("all");
            setCalendarEventToOpenId(null);
            setSelectedDate(DateTime.now().setZone(preferredTimezone).toISODate() ?? selectedDate);
            setView("agenda");
          }
          setActiveTab(tab);
        }}
      />

      {selectedPhoto ? (
        <PhotoViewer
          canOpenOwner={Boolean(
            profile &&
              (selectedPhoto.ownerId === profile.id ||
                connections.some((connection) => connection.id === selectedPhoto.ownerId))
          )}
          canDelete={Boolean(profile && selectedPhoto.ownerId === profile.id)}
          canEdit={Boolean(profile && selectedPhoto.ownerId === profile.id)}
          onOpenOwner={openPhotoOwner}
          onDelete={deletePhoto}
          onEditCaption={updatePhotoCaption}
          onShare={copyPhotoShareLink}
          onExitContext={() => {
            setSelectedPhotoId(null);
            if (activeTab === "connections") {
              setSelectedConnectionId(null);
              setSelectedConnectionProfile(null);
            }
            if (activeTab === "groups") {
              setActiveGroupId(null);
            }
          }}
          photo={selectedPhoto}
          photos={viewerPhotos.length ? viewerPhotos : allPhotos}
          setSelectedPhotoId={setSelectedPhotoId}
        />
      ) : null}
      {pendingCaptureSrc ? (
        <SharePhotoSheet
          groups={groups}
          initialTarget={activeTab === "groups" && activeGroup ? { type: "group", groupId: activeGroup.id } : { type: "connections" }}
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
      {workoutLogEventId ? (
        <WorkoutLogSheet
          event={events.find((event) => event.id === workoutLogEventId) ?? null}
          getAuthHeaders={authHeaders}
          onClose={() => setWorkoutLogEventId(null)}
          onLogged={() => {
            setWorkoutLogEventId(null);
            void loadWorkspace();
          }}
          profile={profile}
          setMessage={setMessage}
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
  selectedConnection,
  onBack,
  onOpenProfile,
  onRemoveConnection,
  onSendRequest
}: {
  openPhoto: OpenPhoto;
  photos: PhotoItem[];
  selectedConnection: ConnectionProfile | null;
  onBack: () => void;
  onOpenProfile: (profileId: string) => void;
  onRemoveConnection: (profileId: string) => void;
  onSendRequest: (profileId: string) => void;
}) {
  const owners = [...new Set(photos.map((photo) => photo.ownerId))];
  const [connectionActionOpen, setConnectionActionOpen] = useState(false);
  const connectionActionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setConnectionActionOpen(false);
  }, [selectedConnection?.id]);

  useEffect(() => {
    if (!connectionActionOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && connectionActionRef.current?.contains(target)) return;
      setConnectionActionOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [connectionActionOpen]);

  if (selectedConnection) {
    const profilePhotos = photos.filter((photo) => photo.ownerId === selectedConnection.id);
    const actionLabel =
      selectedConnection.relationship === "connected"
        ? "Connected"
        : selectedConnection.relationship === "pending_sent"
          ? "Requested"
          : selectedConnection.relationship === "pending_received"
            ? "Accept in notifications"
            : "Connect";
    const actionDisabled =
      selectedConnection.relationship === "pending_sent" || selectedConnection.relationship === "pending_received";
    return (
      <section className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button className="grid h-10 w-10 place-items-center" onClick={onBack} type="button">
            <ArrowLeft size={21} />
          </button>
        </div>
        <section className="rounded-lg border border-white/70 bg-white/85 p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#242420]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar name={selectedConnection.displayName} src={selectedConnection.avatarUrl} size="lg" />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold">{selectedConnection.displayName}</h1>
                <p className="text-sm text-ink/55 dark:text-paper/55">{selectedConnection.username}</p>
                <p className="mt-2 text-xs text-ink/45 dark:text-paper/45">{selectedConnection.preferredTimezone}</p>
              </div>
            </div>
            <div ref={connectionActionRef} className="relative shrink-0">
              <button
                className={clsx(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium",
                  selectedConnection.relationship === "none"
                    ? "bg-ink text-paper dark:bg-paper dark:text-ink"
                    : selectedConnection.relationship === "connected"
                      ? "border border-[#1f73ff]/45 text-[#1f73ff]"
                      : "border border-line text-ink/65 dark:border-white/15 dark:text-paper/65",
                  actionDisabled && "opacity-60"
                )}
                disabled={actionDisabled}
                onClick={() => {
                  if (selectedConnection.relationship === "connected") {
                    setConnectionActionOpen((value) => !value);
                    return;
                  }
                  onSendRequest(selectedConnection.id);
                }}
                type="button"
              >
                {actionLabel}
                {selectedConnection.relationship === "connected" ? <ChevronDown size={13} /> : null}
              </button>
              {selectedConnection.relationship === "connected" && connectionActionOpen ? (
                <div className="absolute right-0 top-9 z-10 w-44 rounded-lg border border-line bg-white p-1 shadow-soft dark:border-white/15 dark:bg-[#242420]">
                  <button
                    className="w-full rounded-md px-3 py-2 text-left text-xs font-medium text-rust transition hover:bg-paper dark:hover:bg-[#1d1d1a]"
                    onClick={() => {
                      setConnectionActionOpen(false);
                      onRemoveConnection(selectedConnection.id);
                    }}
                    type="button"
                  >
                    Remove connection
                  </button>
                </div>
              ) : null}
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
      ) : (
        <EmptyPanel title="No shared feed yet" body="Search for someone to connect with." />
      )}
    </section>
  );
}

function ConnectionSearchModal({
  query,
  results,
  setQuery,
  onClose,
  onOpenProfile,
  onSendRequest
}: {
  query: string;
  results: ConnectionProfile[];
  setQuery: (value: string) => void;
  onClose: () => void;
  onOpenProfile: (profile: ConnectionProfile) => void;
  onSendRequest: (profileId: string) => void;
}) {
  const trimmedQuery = query.trim();

  return (
    <div
      className="fixed inset-0 z-40 flex items-start bg-black/20 px-3 pt-[calc(5rem+env(safe-area-inset-top))] backdrop-blur-sm dark:bg-black/45"
      onClick={onClose}
    >
      <section
        className="mx-auto w-full max-w-lg rounded-2xl border border-white/80 bg-white p-4 text-ink shadow-soft dark:border-white/15 dark:bg-[#242420] dark:text-paper"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Search</h2>
          <button
            className="text-sm font-semibold text-ink/55 transition hover:text-ink dark:text-paper/55 dark:hover:text-paper"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
        </div>
        <label className="mb-4 flex items-center gap-2 border-b border-line px-1 py-3 dark:border-white/15">
          <Search size={19} />
          <input
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink/40 dark:placeholder:text-paper/40"
            placeholder="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="max-h-[55vh] overflow-y-auto overscroll-contain pr-1">
          {trimmedQuery.length < 2 ? (
            <p className="py-8 text-center text-sm text-ink/55 dark:text-paper/55">
              Search by username or name.
            </p>
          ) : results.length ? (
            <section className="grid gap-3">
              {results.map((result) => (
                <ConnectionSearchResult
                  key={result.id}
                  profile={result}
                  onOpenProfile={onOpenProfile}
                  onSendRequest={onSendRequest}
                />
              ))}
            </section>
          ) : (
            <p className="py-8 text-center text-sm text-ink/55 dark:text-paper/55">No matching people yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function ConnectionSearchResult({
  profile,
  onOpenProfile,
  onSendRequest
}: {
  profile: ConnectionProfile;
  onOpenProfile: (profile: ConnectionProfile) => void;
  onSendRequest: (profileId: string) => void;
}) {
  const actionLabel =
    profile.relationship === "connected"
      ? "View"
      : profile.relationship === "pending_sent"
        ? "Requested"
        : profile.relationship === "pending_received"
          ? "Accept in notifications"
          : "Connect";

  return (
    <article className="flex items-center gap-3 rounded-lg border border-white/70 bg-white/85 p-3 shadow-sm dark:border-white/15 dark:bg-[#242420]">
      <button
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() => onOpenProfile(profile)}
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
        onClick={() => (profile.relationship === "connected" ? onOpenProfile(profile) : onSendRequest(profile.id))}
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
  groupMembers,
  groups,
  notifyGroupMembers,
  onOpenGroupCalendar,
  onOpenGroupProjects,
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
  groupMembers: Record<string, GroupMember[]>;
  groups: Group[];
  notifyGroupMembers: (groupId: string, message: string, metadata?: Record<string, unknown>) => Promise<void>;
  onOpenGroupCalendar: (groupId: string) => void;
  onOpenGroupProjects: (groupId: string) => void;
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
          members={groupMembers[activeGroup.id] ?? []}
          notifyGroupMembers={notifyGroupMembers}
          onOpenGroupCalendar={onOpenGroupCalendar}
          onOpenGroupProjects={onOpenGroupProjects}
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
  onOpenGroups,
  onOpenSettings
}: {
  connections: ConnectionProfile[];
  groups: Group[];
  openPhoto: OpenPhoto;
  photos: PhotoItem[];
  profile: Profile;
  onOpenConnection: (profileId: string) => void;
  onOpenGroups: () => void;
  onOpenSettings: () => void;
}) {
  const ownPhotos = photos.filter((photo) => photo.ownerId === profile.id);
  const [showConnections, setShowConnections] = useState(false);

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-lg border border-white/70 bg-white/85 p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#242420]">
        <div className="flex items-center gap-4">
          <Avatar name={profile.display_name} src={profile.avatar_url ?? ""} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{profile.display_name}</h1>
            <p className="truncate text-sm text-ink/55 dark:text-paper/55">{profile.username}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 divide-x divide-line rounded-lg border border-line bg-paper/70 text-center dark:divide-white/15 dark:border-white/15 dark:bg-[#1d1d1a]">
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
          <button className="grid place-items-center px-2 py-3" onClick={onOpenSettings} type="button">
            <Settings size={20} />
            <span className="mt-1 text-xs text-ink/55 dark:text-paper/55">Settings</span>
          </button>
        </div>
      </div>

      {showConnections ? (
        connections.length ? (
          <section className="grid gap-3">
            {connections.map((connection) => (
              <button
                key={connection.id}
                className="flex items-center gap-3 rounded-lg border border-white/70 bg-white/85 p-3 text-left shadow-sm dark:border-white/15 dark:bg-[#242420]"
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

const projectTypeOptions: { label: string; value: ProjectType }[] = [
  { label: "Fitness", value: "fitness" },
  { label: "Writing", value: "writing" },
  { label: "Audio", value: "audio" },
  { label: "Music", value: "music" }
];

const projectSubtypeOptions: Record<ProjectType, { label: string; value: string }[]> = {
  fitness: [
    { label: "Weight training", value: "weight_training" },
    { label: "Running", value: "running" },
    { label: "Sport", value: "sport" },
    { label: "Mobility", value: "mobility" }
  ],
  writing: [
    { label: "Journal", value: "journal" },
    { label: "Stories", value: "stories" },
    { label: "Novel", value: "novel" },
    { label: "Screenplay", value: "screenplay" }
  ],
  audio: [
    { label: "Voice memos", value: "voice_memos" },
    { label: "Interviews", value: "interviews" },
    { label: "Field notes", value: "field_notes" }
  ],
  music: [
    { label: "Song", value: "song" },
    { label: "Instrumental", value: "instrumental" },
    { label: "Practice", value: "practice" }
  ]
};

type ProjectCompanionResult = {
  title: string;
  body: string;
  items: string[];
  template?: "fitness_workout" | "audio_studio" | "project_notes";
  workout?: {
    label: string;
    date: string;
    focus: string;
    summary: string;
    days: string[];
    exercises: { name: string; prescription: string }[];
  };
  program?: {
    sessions: { focus: string; summary: string; exercises: { name: string; prescription: string }[] }[];
  };
};

function defaultSubtype(type: ProjectType) {
  return projectSubtypeOptions[type][0]?.value ?? type;
}

const categoryEmoji: Record<ProjectCategoryKey, string> = {
  audio: "🎧",
  fitness: "⚡",
  writing: "📝"
};

const subtypeEmoji: Record<string, string> = {
  field_notes: "🗒️",
  instrumental: "🎸",
  interviews: "💬",
  journal: "📔",
  mobility: "🧘",
  novel: "📚",
  practice: "🔁",
  running: "🏃",
  screenplay: "🎬",
  song: "🎵",
  sport: "🏆",
  stories: "📖",
  voice_memos: "🎙️",
  weight_training: "🏋️"
};

function categoryEmojiForType(type: ProjectType): string {
  if (type === "fitness") return categoryEmoji.fitness;
  if (type === "writing") return categoryEmoji.writing;
  return categoryEmoji.audio;
}

function projectEmoji(type: ProjectType, subtype: string | null): string {
  return (subtype && subtypeEmoji[subtype]) || categoryEmojiForType(type);
}

type ProjectCategoryKey = "fitness" | "writing" | "audio";

const projectCategories: { key: ProjectCategoryKey; label: string; hint: string }[] = [
  { key: "fitness", label: "Fitness", hint: "plans + workouts" },
  { key: "writing", label: "Writing", hint: "journal + drafts" },
  { key: "audio", label: "Audio", hint: "voice + music" }
];

function matchesCategory(project: ProjectItem, key: ProjectCategoryKey) {
  if (key === "audio") return project.type === "audio" || project.type === "music";
  return project.type === key;
}

type WebNode = { kind: "project"; project: ProjectItem } | { kind: "create" };

function ProjectWeb({
  categories,
  onCreateProject,
  onSelectProject,
  projects
}: {
  categories: { key: ProjectCategoryKey; label: string; hint: string }[];
  onCreateProject: (key: ProjectCategoryKey) => void;
  onSelectProject: (id: string) => void;
  projects: ProjectItem[];
}) {
  const [activeCategory, setActiveCategory] = useState<ProjectCategoryKey | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);
  const activeCategoryProjects = activeCategory ? projects.filter((project) => matchesCategory(project, activeCategory)) : [];
  const nodes: WebNode[] = [...activeCategoryProjects.map((project) => ({ kind: "project" as const, project })), { kind: "create" as const }];
  const canvasHeight = 230;
  const canvasWidth = Math.max(340, 150 + nodes.length * 48);
  const anchorX = canvasWidth / 2;
  const anchorY = 34;
  const radius = Math.min(150, 84 + nodes.length * 5);
  const squishY = 0.6;
  const spread = nodes.length <= 1 ? 0 : Math.min(150, 26 * (nodes.length - 1));
  const positions = nodes.map((node, index) => {
    const angleDeg = nodes.length === 1 ? 0 : -spread / 2 + index * (spread / (nodes.length - 1));
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      node,
      x: anchorX + radius * Math.sin(angleRad),
      y: anchorY + radius * Math.cos(angleRad) * squishY
    };
  });

  useEffect(() => {
    if (!activeCategory || !scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollLeft = Math.max(0, (canvasWidth - el.clientWidth) / 2);
  }, [activeCategory, canvasWidth]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || !scrollRef.current) return;
    dragRef.current = { startScrollLeft: scrollRef.current.scrollLeft, startX: event.clientX };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !scrollRef.current) return;
    scrollRef.current.scrollLeft = dragRef.current.startScrollLeft - (event.clientX - dragRef.current.startX);
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  return (
    <div className="grid gap-1">
      <div className="flex justify-center gap-3 py-2 sm:gap-6">
        {categories.map((category) => {
          const isActive = category.key === activeCategory;
          const count = projects.filter((project) => matchesCategory(project, category.key)).length;
          return (
            <button
              key={category.key}
              className="flex flex-col items-center gap-1.5"
              onClick={() => setActiveCategory((current) => (current === category.key ? null : category.key))}
              type="button"
            >
              <span
                className={clsx(
                  "grid h-16 w-16 place-items-center rounded-full border-2 text-2xl transition-all",
                  isActive
                    ? "web-node-active scale-105 border-clay bg-clay/20"
                    : "border-line bg-white/70 dark:border-white/15 dark:bg-white/[0.03]"
                )}
              >
                {categoryEmoji[category.key]}
              </span>
              <span className={clsx("text-xs font-semibold", isActive ? "text-ink dark:text-paper" : "text-ink/55 dark:text-paper/55")}>
                {category.label}
              </span>
              <span className="text-[10px] text-ink/40 dark:text-paper/40">{count}</span>
            </button>
          );
        })}
      </div>

      {activeCategory ? (
        <div
          key={activeCategory}
          ref={scrollRef}
          className="cursor-grab overflow-x-auto active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerLeave={handlePointerUp}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="relative text-clay" style={{ height: canvasHeight, width: canvasWidth }}>
            <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}>
              <line
                className="web-line"
                pathLength={1}
                stroke="currentColor"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                x1={anchorX}
                x2={anchorX}
                y1={0}
                y2={anchorY}
              />
              {positions.map(({ x, y }, index) => (
                <line
                  key={index}
                  className="web-line"
                  pathLength={1}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  style={{ animationDelay: `${index * 70}ms` }}
                  vectorEffect="non-scaling-stroke"
                  x1={anchorX}
                  x2={x}
                  y1={anchorY}
                  y2={y}
                />
              ))}
            </svg>
            {positions.map(({ node, x, y }, index) => {
              const isCreate = node.kind === "create";
              return (
                <button
                  key={isCreate ? "create" : node.project.id}
                  className="web-node-pop absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                  style={{ animationDelay: `${index * 70 + 120}ms`, left: x, top: y }}
                  onClick={() => (isCreate ? onCreateProject(activeCategory) : onSelectProject(node.project.id))}
                  type="button"
                >
                  <span
                    className={clsx(
                      "grid h-12 w-12 place-items-center rounded-full border-2 text-xl shadow-soft",
                      isCreate
                        ? "border-dashed border-clay/60 bg-white/70 text-clay dark:bg-[#1d1d1a]"
                        : "border-line bg-white dark:border-white/15 dark:bg-[#242420]"
                    )}
                  >
                    {isCreate ? <Plus size={18} /> : projectEmoji(node.project.type, node.project.subtype)}
                  </span>
                  <span className="max-w-[4.5rem] truncate text-center text-[11px] font-medium text-ink/70 dark:text-paper/70">
                    {isCreate ? "new" : node.project.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const WEEKDAY_KEYS: WeekDayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const WEEKDAY_OPTIONS: { key: WeekDayKey; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" }
];

function playMetronomeClick(audioContext: AudioContext, accent: boolean) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = accent ? 1000 : 700;
  gain.gain.setValueAtTime(0.28, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.05);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ProjectsView({
  dashboardScope,
  setDashboardScope,
  events,
  getAuthHeaders,
  groups,
  onOpenWorkoutLog,
  profile,
  projects,
  reload,
  reloadProjects,
  setActiveTab,
  setCalendarGroupId,
  setMessage
}: {
  dashboardScope: string;
  setDashboardScope: (id: string) => void;
  events: EventItem[];
  getAuthHeaders: (options?: { refresh?: boolean }) => Promise<{ Authorization: string } | null>;
  groups: Group[];
  onOpenWorkoutLog: (eventId: string) => void;
  profile: Profile;
  projects: ProjectItem[];
  reload: WorkspaceReload;
  reloadProjects: () => Promise<void>;
  setActiveTab: (tab: AppTab) => void;
  setCalendarGroupId: (id: string) => void;
  setMessage: (value: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [entries, setEntries] = useState<ProjectEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("fitness");
  const [lockedProjectType, setLockedProjectType] = useState<ProjectType | null>(null);
  const [projectSubtype, setProjectSubtype] = useState(defaultSubtype("fitness"));
  const [projectScope, setProjectScope] = useState("personal");
  const [entryTitle, setEntryTitle] = useState("");
  const [entryBody, setEntryBody] = useState("");
  const [programOpen, setProgramOpen] = useState(false);
  const [programStep, setProgramStep] = useState<1 | 2 | 3 | 4>(1);
  const [programStartDate, setProgramStartDate] = useState(DateTime.now().setZone(profile.preferred_timezone).toISODate() ?? "");
  const [programWeeks, setProgramWeeks] = useState(4);
  const [programSelectedDays, setProgramSelectedDays] = useState<WeekDayKey[]>([]);
  const [programTimeMode, setProgramTimeMode] = useState<"same" | "per-day">("same");
  const [programSameTime, setProgramSameTime] = useState("07:00");
  const [programPerDayTimes, setProgramPerDayTimes] = useState<Partial<Record<WeekDayKey, string>>>({});
  const [programNote, setProgramNote] = useState("");
  const [creatingProgram, setCreatingProgram] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [metronomeOn, setMetronomeOn] = useState(true);
  const [countingIn, setCountingIn] = useState<number | null>(null);
  const [instrument, setInstrument] = useState("");
  const [playStemsWhileRecording, setPlayStemsWhileRecording] = useState(true);
  const [savingProject, setSavingProject] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [companionPrompt, setCompanionPrompt] = useState("");
  const [companionResult, setCompanionResult] = useState<ProjectCompanionResult | null>(null);
  const [askingCompanion, setAskingCompanion] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const metronomeTimerRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const playbackAudiosRef = useRef<HTMLAudioElement[]>([]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const dashboardProjects = projects.filter((project) =>
    dashboardScope === "personal" ? !project.group_id : project.group_id === dashboardScope
  );
  const canUseCompanion = selectedProject?.type === "fitness" || selectedProject?.type === "music" || selectedProject?.type === "audio";
  const stemEntries = entries.filter((entry) => entry.kind === "stem");
  const voiceMemoEntries = entries.filter((entry) => entry.kind === "voice_memo");
  const logEntries = entries.filter((entry) => entry.kind !== "stem" && entry.kind !== "voice_memo");
  const recordedTime = `${String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:${String(recordingSeconds % 60).padStart(2, "0")}`;
  const fitnessEvents = selectedProject
    ? events.filter((event) => event.project_id === selectedProject.id).sort((a, b) => a.starts_at_utc.localeCompare(b.starts_at_utc))
    : [];
  const upcomingFitnessEvents = fitnessEvents.filter((event) => DateTime.fromISO(event.starts_at_utc).toMillis() >= DateTime.now().toMillis());
  const orderedProgramDays = WEEKDAY_KEYS.filter((key) => programSelectedDays.includes(key));
  const generatedSessions = companionResult?.program?.sessions ?? [];

  useEffect(() => {
    if (selectedProjectId && !projects.some((project) => project.id === selectedProjectId)) setSelectedProjectId("");
  }, [projects, selectedProjectId]);

  useEffect(() => {
    setProjectSubtype(defaultSubtype(projectType));
  }, [projectType]);

  useEffect(() => {
    if (!selectedProject?.id) {
      setEntries([]);
      return;
    }
    void loadEntries(selectedProject.id);
  }, [selectedProject?.id]);

  useEffect(() => {
    setCompanionResult(null);
    setProgramOpen(false);
    setProgramStep(1);
    setProgramSelectedDays([]);
    setProgramNote("");
    recorderRef.current?.stop();
    if (metronomeTimerRef.current) {
      window.clearInterval(metronomeTimerRef.current);
      metronomeTimerRef.current = null;
    }
    playbackAudiosRef.current.forEach((audioEl) => audioEl.pause());
    playbackAudiosRef.current = [];
    void wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    setRecording(false);
    setCountingIn(null);
    setAudioUrl("");
    setAudioBlob(null);
    setInstrument("");
  }, [selectedProject?.id, selectedProject?.type]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordingSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  async function loadEntries(projectId = selectedProjectId) {
    if (!projectId) return;
    const headers = await getAuthHeaders();
    if (!headers) return;
    setEntriesLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/entries`, { headers });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Could not load project entries.");
        return;
      }
      setEntries(payload.entries ?? []);
    } finally {
      setEntriesLoading(false);
    }
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    if (savingProject || !projectName.trim()) return;
    const headers = await getAuthHeaders();
    if (!headers) return;
    const storedType = projectSubtype === "music" ? "music" : projectType;
    setSavingProject(true);
    setMessage("");
    try {
      const response = await fetch("/api/projects", {
        body: JSON.stringify({
          groupId: projectScope === "personal" ? null : projectScope,
          name: projectName.trim(),
          settings: storedType === "music" ? { bars: 8, bpm: 120 } : {},
          subtype: projectSubtype,
          type: storedType
        }),
        headers: { ...headers, "content-type": "application/json" },
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Could not create project.");
        return;
      }
      await reloadProjects();
      setSelectedProjectId(payload.project?.id ?? selectedProjectId);
      setProjectName("");
      setCreating(false);
      setMessage("Project created.");
    } finally {
      setSavingProject(false);
    }
  }

  async function saveProjectEntry({
    body,
    kind,
    occurredAt,
    title
  }: {
    body?: string | null;
    kind: ProjectEntryKind;
    occurredAt: string;
    title: string;
  }) {
    if (!selectedProject || savingEntry || !title.trim()) return;
    const headers = await getAuthHeaders();
    if (!headers) return;
    setSavingEntry(true);
    setMessage("");
    try {
      const response = await fetch(`/api/projects/${selectedProject.id}/entries`, {
        body: JSON.stringify({
          body: body?.trim() || null,
          kind,
          metadata: {
            source: selectedProject.type,
            timezone: profile.preferred_timezone
          },
          occurredAt,
          title: title.trim()
        }),
        headers: { ...headers, "content-type": "application/json" },
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Could not save project entry.");
        return;
      }

      setEntryTitle("");
      setEntryBody("");
      await loadEntries(selectedProject.id);
      await reload();
      setMessage("Project entry saved.");
    } finally {
      setSavingEntry(false);
    }
  }

  function toggleProgramDay(day: WeekDayKey) {
    setProgramSelectedDays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]));
  }

  async function generateProgramSessions() {
    if (!selectedProject || !programSelectedDays.length) return;
    await askCompanion(selectedProject.id, programNote, programSelectedDays.length, generatedSessions.length ? generatedSessions : undefined);
    setProgramStep(4);
  }

  async function confirmProgram() {
    const sessions = companionResult?.program?.sessions;
    if (!selectedProject || !supabase || !sessions?.length || creatingProgram) return;
    setCreatingProgram(true);
    setMessage("");
    try {
      const start = DateTime.fromISO(programStartDate, { zone: profile.preferred_timezone }).startOf("day");
      const end = start.plus({ weeks: programWeeks }).minus({ days: 1 });
      const rows: Record<string, unknown>[] = [];
      let cursor = start;
      let occurrence = 0;
      while (cursor <= end) {
        const dayKey = WEEKDAY_KEYS[cursor.weekday - 1];
        if (orderedProgramDays.includes(dayKey)) {
          const session = sessions[occurrence % sessions.length];
          occurrence += 1;
          const time = programTimeMode === "same" ? programSameTime : programPerDayTimes[dayKey] || programSameTime;
          const [hour, minute] = time.split(":").map(Number);
          const startsAt = cursor.set({ hour: hour || 0, minute: minute || 0 }).toUTC().toISO();
          if (startsAt) {
            rows.push({
              creator_id: profile.id,
              description: session.exercises.map((exercise) => `${exercise.name}: ${exercise.prescription}`).join("\n"),
              group_id: selectedProject.group_id,
              location: null,
              owner_id: profile.id,
              project_id: selectedProject.id,
              reference: null,
              source_timezone: profile.preferred_timezone,
              starts_at_utc: startsAt,
              title: session.focus
            });
          }
        }
        cursor = cursor.plus({ days: 1 });
      }

      if (!rows.length) {
        setMessage("No sessions fell inside that date range.");
        return;
      }

      const { error } = await supabase.from("events").insert(rows);
      if (error) {
        setMessage(`Could not add program to calendar. ${error.message}`);
        return;
      }

      setProgramOpen(false);
      setProgramStep(1);
      setCompanionResult(null);
      await reload();
      setMessage(`Program added — ${rows.length} sessions on your calendar.`);
    } finally {
      setCreatingProgram(false);
    }
  }

  async function saveWritingPage() {
    const timestamp = DateTime.now().setZone(profile.preferred_timezone).toUTC().toISO() ?? new Date().toISOString();
    await saveProjectEntry({
      body: entryBody,
      kind: selectedProject?.subtype === "journal" ? "journal" : "draft",
      occurredAt: timestamp,
      title: entryTitle.trim() || DateTime.now().setZone(profile.preferred_timezone).toFormat("LLL d")
    });
  }

  async function saveAudioNote() {
    if (!selectedProject || !audioBlob || savingEntry || !supabase) return;
    const headers = await getAuthHeaders();
    if (!headers) return;
    const isMusic = selectedProject.type === "music";
    setSavingEntry(true);
    setMessage("");
    try {
      const mediaPath = `${profile.id}/${crypto.randomUUID()}.webm`;
      const { error: uploadError } = await supabase.storage.from("project-audio").upload(mediaPath, audioBlob, {
        contentType: "audio/webm",
        upsert: false
      });
      if (uploadError) {
        setMessage(`Failed to save recording. ${uploadError.message}`);
        return;
      }

      const timestamp = DateTime.now().setZone(profile.preferred_timezone).toUTC().toISO() ?? new Date().toISOString();
      const response = await fetch(`/api/projects/${selectedProject.id}/entries`, {
        body: JSON.stringify({
          body: entryBody.trim() || null,
          kind: isMusic ? "stem" : "voice_memo",
          mediaPath,
          metadata: isMusic ? { instrument: instrument || "other" } : {},
          occurredAt: timestamp,
          title:
            entryTitle.trim() ||
            (isMusic ? `take ${stemEntries.length + 1}` : `voice memo ${DateTime.now().setZone(profile.preferred_timezone).toFormat("LLL d, h:mm a")}`)
        }),
        headers: { ...headers, "content-type": "application/json" },
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Could not save recording.");
        await supabase.storage.from("project-audio").remove([mediaPath]);
        return;
      }

      setEntryTitle("");
      setEntryBody("");
      setInstrument("");
      setAudioBlob(null);
      setAudioUrl("");
      await loadEntries(selectedProject.id);
      setMessage(isMusic ? "Stem saved." : "Recording saved.");
    } finally {
      setSavingEntry(false);
    }
  }

  async function deleteProject(project: ProjectItem) {
    if (!window.confirm(`Delete ${project.name}?`)) return;
    const headers = await getAuthHeaders();
    if (!headers) return;
    const response = await fetch(`/api/projects/${project.id}`, { headers, method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Could not delete project.");
      return;
    }
    setSelectedProjectId("");
    await reloadProjects();
    await reload();
    setMessage("Project deleted.");
  }

  async function deleteProjectEntry(entry: ProjectEntry) {
    if (!selectedProject || !window.confirm(`Delete ${entry.title}?`)) return;
    const headers = await getAuthHeaders();
    if (!headers) return;
    const response = await fetch(`/api/projects/${selectedProject.id}/entries/${entry.id}`, { headers, method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Could not delete entry.");
      return;
    }
    await loadEntries(selectedProject.id);
    setMessage("Entry deleted.");
  }

  async function askCompanion(
    projectId = selectedProject?.id ?? "",
    prompt = companionPrompt,
    daysPerWeek?: number,
    previousSessions?: ProgramSession[]
  ) {
    if (!projectId || !canUseCompanion || askingCompanion) return;
    const headers = await getAuthHeaders();
    if (!headers) return;
    setAskingCompanion(true);
    setMessage("");
    try {
      const response = await fetch("/api/ai/companion", {
        body: JSON.stringify({ daysPerWeek, previousSessions, projectId, prompt }),
        headers: { ...headers, "content-type": "application/json" },
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Companion could not answer.");
        return;
      }
      setCompanionResult(payload.result ?? null);
    } finally {
      setAskingCompanion(false);
    }
  }

  function openProjectCalendar(project: ProjectItem) {
    setCalendarGroupId(project.group_id ?? "personal");
    setActiveTab("calendar");
  }

  function stopEverything() {
    if (metronomeTimerRef.current) {
      window.clearInterval(metronomeTimerRef.current);
      metronomeTimerRef.current = null;
    }
    playbackAudiosRef.current.forEach((audioEl) => audioEl.pause());
    playbackAudiosRef.current = [];
    void wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (countingIn !== null) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("Audio recording is not available in this browser.");
      return;
    }

    const isMusic = selectedProject?.type === "music";
    const bpm = Number(selectedProject?.settings?.bpm ?? 120) || 120;
    const beatMs = 60000 / bpm;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (isMusic && metronomeOn) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        const audioContext = audioContextRef.current;
        if (audioContext.state === "suspended") await audioContext.resume();

        for (let beat = 4; beat >= 1; beat--) {
          setCountingIn(beat);
          playMetronomeClick(audioContext, beat === 4);
          await wait(beatMs);
        }
        setCountingIn(null);
      }

      if ("wakeLock" in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        } catch {
          wakeLockRef.current = null;
        }
      }

      if (isMusic && playStemsWhileRecording && stemEntries.length) {
        playbackAudiosRef.current = stemEntries
          .filter((entry) => entry.media_url)
          .map((entry) => {
            const audioEl = new Audio(entry.media_url ?? "");
            void audioEl.play().catch(() => {});
            return audioEl;
          });
      }

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        stopEverything();
        setRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);

      if (isMusic && metronomeOn && audioContextRef.current) {
        const audioContext = audioContextRef.current;
        let beatCount = 0;
        metronomeTimerRef.current = window.setInterval(() => {
          playMetronomeClick(audioContext, beatCount % 4 === 0);
          beatCount += 1;
        }, beatMs);
      }
    } catch {
      setCountingIn(null);
      stopEverything();
      setMessage("Could not access microphone.");
    }
  }

  function playAllStems() {
    stemEntries.forEach((entry) => {
      if (!entry.media_url) return;
      const audioEl = new Audio(entry.media_url);
      void audioEl.play().catch(() => {});
    });
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <button
          className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold dark:border-white/15"
          onClick={() => {
            setLockedProjectType(null);
            setCreating(true);
          }}
          type="button"
        >
          <Plus size={16} />
          Create new
        </button>
      </div>

      {creating ? (
        <div className="session-fullscreen-in fixed inset-0 z-50 flex flex-col overflow-y-auto bg-paper text-ink dark:bg-[#151515] dark:text-paper">
          <form className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-6" onSubmit={createProject}>
            <div className="flex items-center justify-between gap-3 py-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
              <div className="flex items-center gap-2">
                <FolderOpen size={18} />
                <h2 className="text-lg font-semibold">{lockedProjectType ? `new ${lockedProjectType} project` : "new project"}</h2>
              </div>
              <button
                className="grid h-10 w-10 place-items-center rounded-full border border-line dark:border-white/15"
                onClick={() => {
                  setCreating(false);
                  setLockedProjectType(null);
                }}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3">
              <Field label="Name" value={projectName} onChange={setProjectName} required placeholder="morning strength" />
              {lockedProjectType ? null : (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: "fitness" as ProjectType, label: "fitness", hint: "plans + workouts" },
                    { type: "writing" as ProjectType, label: "writing", hint: "journal + drafts" },
                    { type: "audio" as ProjectType, label: "audio", hint: "voice + music" }
                  ].map((option) => (
                    <button
                      key={option.type}
                      className={clsx(
                        "rounded-2xl border p-3 text-left",
                        projectType === option.type
                          ? "border-paper bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink"
                          : "border-line bg-white/60 dark:border-white/15 dark:bg-white/5"
                      )}
                      onClick={() => setProjectType(option.type)}
                      type="button"
                    >
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-clay/18 text-lg">
                        {categoryEmojiForType(option.type)}
                      </div>
                      <p className="font-semibold">{option.label}</p>
                      <p className="mt-1 text-[11px] opacity-65">{option.hint}</p>
                    </button>
                  ))}
                </div>
              )}
              <label className="flex flex-col gap-1 text-sm font-medium">
                Template
                <select
                  className="rounded-full border border-line bg-white px-3 py-2 text-sm text-ink outline-none dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
                  value={projectSubtype}
                  onChange={(event) => setProjectSubtype(event.target.value)}
                >
                  {(projectType === "audio"
                    ? [
                        ...projectSubtypeOptions.audio,
                        { label: "Music", value: "music" }
                      ]
                    : projectSubtypeOptions[projectType]
                  ).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Scope
                <select
                  className="rounded-full border border-line bg-white px-3 py-2 text-sm text-ink outline-none dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
                  value={projectScope}
                  onChange={(event) => setProjectScope(event.target.value)}
                >
                  <option value="personal">Personal</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="rounded-full bg-ink px-4 py-3 font-semibold text-paper dark:bg-paper dark:text-ink" disabled={savingProject}>
                {savingProject ? "Creating..." : "Create project"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {!selectedProject ? (
        <div className="grid gap-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              className={clsx(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition",
                dashboardScope === "personal"
                  ? "border-ink bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink"
                  : "border-line text-ink/60 dark:border-white/15 dark:text-paper/60"
              )}
              onClick={() => setDashboardScope("personal")}
              type="button"
            >
              Personal
            </button>
            {groups.map((group) => (
              <button
                key={group.id}
                className={clsx(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition",
                  dashboardScope === group.id
                    ? "border-ink bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink"
                    : "border-line text-ink/60 dark:border-white/15 dark:text-paper/60"
                )}
                onClick={() => setDashboardScope(group.id)}
                type="button"
              >
                {group.name}
              </button>
            ))}
          </div>

          <div className="rounded-3xl border border-line bg-white/70 p-4 dark:border-white/15 dark:bg-white/[0.03]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">
              {dashboardScope === "personal" ? "Personal" : groups.find((group) => group.id === dashboardScope)?.name ?? "Group"}
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {dashboardProjects.length} project{dashboardProjects.length === 1 ? "" : "s"}
            </p>
          </div>

          <ProjectWeb
            categories={projectCategories}
            onCreateProject={(key) => {
              const type = key === "audio" ? "audio" : key;
              setProjectType(type);
              setLockedProjectType(type);
              setProjectScope(dashboardScope);
              setCreating(true);
            }}
            onSelectProject={(id) => {
              setSelectedProjectId(id);
              setCompanionResult(null);
            }}
            projects={dashboardProjects}
          />
        </div>
      ) : null}

      {selectedProject ? (
        <section className="grid gap-4">
          <div className="flex items-center justify-between gap-3 border-b border-line pb-4 dark:border-white/10">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line dark:border-white/15" onClick={() => setSelectedProjectId("")} type="button" aria-label="Back to projects">
                  <ArrowLeft size={19} />
                </button>
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-clay/18 text-xl">
                  {projectEmoji(selectedProject.type, selectedProject.subtype)}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold">{selectedProject.name}</h2>
                  <p className="text-sm text-ink/55 dark:text-paper/55">
                    {selectedProject.group_name ? `${selectedProject.group_name} project` : "personal project"} / {selectedProject.subtype?.replaceAll("_", " ") ?? selectedProject.type}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button className="grid h-10 w-10 place-items-center rounded-full border border-line dark:border-white/15" onClick={() => openProjectCalendar(selectedProject)} type="button" aria-label="Open project calendar">
                <CalendarDays size={17} />
              </button>
              {selectedProject.owner_id === profile.id ? (
                <button className="grid h-10 w-10 place-items-center rounded-full border border-line text-clay dark:border-white/15" onClick={() => deleteProject(selectedProject)} type="button" aria-label="Delete project">
                  <Trash2 size={17} />
                </button>
              ) : null}
            </div>
          </div>

          {selectedProject.type === "fitness" ? (
            <section className="grid gap-4">
              {fitnessEvents.length ? (
                <div className="rounded-3xl border border-line bg-white/80 p-4 shadow-soft dark:border-white/15 dark:bg-[#242420]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-clay">your program</p>
                      <p className="mt-1 text-lg font-semibold">
                        {upcomingFitnessEvents.length} upcoming session{upcomingFitnessEvents.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <button
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold dark:border-white/15"
                      onClick={() => {
                        setProgramStep(1);
                        setProgramOpen(true);
                      }}
                      type="button"
                    >
                      <Sparkles size={13} /> build a new program
                    </button>
                  </div>
                  <div className="grid gap-2">
                    {upcomingFitnessEvents.slice(0, 5).map((event) => (
                      <button
                        key={event.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper/55 p-3 text-left dark:border-white/10 dark:bg-[#1d1d1a]"
                        onClick={() => onOpenWorkoutLog(event.id)}
                        type="button"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold capitalize">{event.title}</span>
                          <span className="block text-xs text-ink/50 dark:text-paper/50">
                            {DateTime.fromISO(event.starts_at_utc).setZone(profile.preferred_timezone).toFormat("cccc, LLL d · h:mm a")}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-ink/60 dark:border-white/15 dark:text-paper/60">
                          log it
                        </span>
                      </button>
                    ))}
                    {!upcomingFitnessEvents.length ? (
                      <p className="text-sm text-ink/50 dark:text-paper/50">No sessions left in this program — build a new one when you're ready.</p>
                    ) : null}
                  </div>
                  <button
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 text-sm font-semibold dark:border-white/15"
                    onClick={() => {
                      setCalendarGroupId(selectedProject.group_id ?? "personal");
                      setActiveTab("calendar");
                    }}
                    type="button"
                  >
                    <CalendarDays size={14} /> view full program on calendar
                  </button>
                </div>
              ) : (
                <div className="rounded-3xl border border-line bg-white/80 p-6 text-center shadow-soft dark:border-white/15 dark:bg-[#242420]">
                  <Sparkles className="mx-auto text-clay" size={28} />
                  <h2 className="mt-3 text-xl font-semibold">build your program</h2>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-ink/55 dark:text-paper/55">
                    tell companion your schedule and it will build a rotation and put every session on your calendar. tap a session there when you want to log it.
                  </p>
                  <button
                    className="mt-4 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper dark:bg-paper dark:text-ink"
                    onClick={() => {
                      setProgramStep(1);
                      setProgramOpen(true);
                    }}
                    type="button"
                  >
                    start
                  </button>
                </div>
              )}

              {programOpen ? (
                <div
                  className="session-fullscreen-in fixed inset-0 z-50 flex flex-col bg-paper text-ink dark:bg-[#151515] dark:text-paper"
                >
                  <div
                    className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col"
                  >
                    <div className="shrink-0 border-b border-line px-4 pb-4 pt-[calc(0.75rem+env(safe-area-inset-top))] dark:border-white/10">
                      <div className="flex items-center justify-between gap-3">
                        <p className="flex items-center gap-2 text-lg font-semibold">
                        <Sparkles size={18} className="text-clay" /> build your program
                        </p>
                        <button aria-label="Close program builder" className="grid h-9 w-9 place-items-center rounded-full border border-line dark:border-white/15" onClick={() => setProgramOpen(false)} type="button">
                          <X size={16} />
                        </button>
                      </div>
                      <div className="mt-4 grid grid-cols-4 gap-1.5" aria-label={`Step ${programStep} of 4`}>
                        {[1, 2, 3, 4].map((step) => (
                          <span key={step} className={clsx("h-1 rounded-full", step <= programStep ? "bg-clay" : "bg-ink/10 dark:bg-white/10")} />
                        ))}
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">

                    {programStep === 1 ? (
                      <div className="flex min-h-full flex-col gap-5">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">step 1</p>
                          <h2 className="mt-2 text-2xl font-semibold">first, what date range?</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-white/70 p-3 text-sm font-medium dark:border-white/15 dark:bg-white/[0.04]">
                            start date
                            <input
                              className="min-w-0 bg-transparent text-sm outline-none"
                              onChange={(event) => setProgramStartDate(event.target.value)}
                              type="date"
                              value={programStartDate}
                            />
                          </label>
                          <label className="flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-white/70 p-3 text-sm font-medium dark:border-white/15 dark:bg-white/[0.04]">
                            how many weeks?
                            <input
                              className="min-w-0 bg-transparent text-sm outline-none"
                              max={26}
                              min={1}
                              onChange={(event) => setProgramWeeks(Math.max(1, Math.min(26, Number(event.target.value) || 1)))}
                              type="number"
                              value={programWeeks}
                            />
                          </label>
                        </div>
                        <button className="mt-auto rounded-full bg-ink px-4 py-3 text-sm font-semibold text-paper dark:bg-paper dark:text-ink" onClick={() => setProgramStep(2)} type="button">
                          next
                        </button>
                      </div>
                    ) : programStep === 2 ? (
                      <div className="flex min-h-full flex-col gap-5">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">step 2</p>
                          <h2 className="mt-2 text-2xl font-semibold">which days do you want to train?</h2>
                          <div className="mt-5 grid grid-cols-7 gap-1.5">
                            {WEEKDAY_OPTIONS.map((option) => (
                              <button
                                key={option.key}
                                className={clsx(
                                  "aspect-square min-w-0 rounded-lg border text-xs font-semibold transition",
                                  programSelectedDays.includes(option.key)
                                    ? "border-ink bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink"
                                    : "border-line text-ink/60 dark:border-white/15 dark:text-paper/60"
                                )}
                                onClick={() => toggleProgramDay(option.key)}
                                type="button"
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          <p className="mt-2 text-xs text-ink/45 dark:text-paper/45">
                            {programSelectedDays.length} day{programSelectedDays.length === 1 ? "" : "s"} a week
                          </p>
                        </div>

                        <div className="mt-auto flex gap-2 pt-4">
                          <button className="flex-1 rounded-full border border-line px-4 py-3 text-sm font-semibold dark:border-white/15" onClick={() => setProgramStep(1)} type="button">
                            back
                          </button>
                          <button
                            className="flex-1 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-paper disabled:opacity-50 dark:bg-paper dark:text-ink"
                            disabled={!programSelectedDays.length}
                            onClick={() => setProgramStep(3)}
                            type="button"
                          >
                            next
                          </button>
                        </div>
                      </div>
                    ) : programStep === 3 ? (
                      <div className="flex min-h-full flex-col gap-6">

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">step 3</p>
                          <h2 className="mt-2 text-2xl font-semibold">when should it happen?</h2>
                        </div>

                        <div>
                          <p className="mb-2 text-sm text-ink/55 dark:text-paper/55">what time?</p>
                          <div className="mb-3 grid grid-cols-2 gap-2">
                            <button
                              className={clsx(
                                "min-h-12 rounded-lg border px-3 py-2 text-sm font-semibold",
                                programTimeMode === "same"
                                  ? "border-ink bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink"
                                  : "border-line text-ink/60 dark:border-white/15 dark:text-paper/60"
                              )}
                              onClick={() => setProgramTimeMode("same")}
                              type="button"
                            >
                              same time all week
                            </button>
                            <button
                              className={clsx(
                                "min-h-12 rounded-lg border px-3 py-2 text-sm font-semibold",
                                programTimeMode === "per-day"
                                  ? "border-ink bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink"
                                  : "border-line text-ink/60 dark:border-white/15 dark:text-paper/60"
                              )}
                              onClick={() => setProgramTimeMode("per-day")}
                              type="button"
                            >
                              different per day
                            </button>
                          </div>
                          {programTimeMode === "same" ? (
                            <input
                              className="h-11 w-full rounded-lg border border-line bg-white px-4 text-sm outline-none dark:border-white/15 dark:bg-[#1d1d1a]"
                              onChange={(event) => setProgramSameTime(event.target.value)}
                              type="time"
                              value={programSameTime}
                            />
                          ) : (
                            <div className="grid gap-2">
                              {orderedProgramDays.map((day) => (
                                <label key={day} className="flex items-center justify-between gap-3 text-sm font-medium">
                                  {WEEKDAY_OPTIONS.find((option) => option.key === day)?.label}
                                  <input
                                    className="h-10 rounded-lg border border-line bg-white px-3 text-sm outline-none dark:border-white/15 dark:bg-[#1d1d1a]"
                                    onChange={(event) => setProgramPerDayTimes((current) => ({ ...current, [day]: event.target.value }))}
                                    type="time"
                                    value={programPerDayTimes[day] ?? programSameTime}
                                  />
                                </label>
                              ))}
                              {!orderedProgramDays.length ? <p className="text-xs text-ink/45 dark:text-paper/45">pick training days first.</p> : null}
                            </div>
                          )}
                        </div>

                        <label className="flex flex-col gap-1 text-sm font-medium">
                          anything else? (injuries, goals, equipment — optional)
                          <textarea
                            className="min-h-20 rounded-2xl border border-line bg-white px-4 py-2 text-sm outline-none dark:border-white/15 dark:bg-[#1d1d1a]"
                            onChange={(event) => setProgramNote(event.target.value)}
                            value={programNote}
                          />
                        </label>

                        <div className="mt-auto flex gap-2 pt-4">
                          <button className="flex-1 rounded-full border border-line px-4 py-3 text-sm font-semibold dark:border-white/15" onClick={() => setProgramStep(2)} type="button">
                            back
                          </button>
                          <button
                            className="flex-1 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-paper disabled:opacity-50 dark:bg-paper dark:text-ink"
                            disabled={!programSelectedDays.length || askingCompanion}
                            onClick={generateProgramSessions}
                            type="button"
                          >
                            {askingCompanion ? "asking companion..." : "ask companion to build it"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">step 4</p>
                          <h2 className="mt-2 text-2xl font-semibold">your program from companion</h2>
                        </div>
                        {askingCompanion ? (
                          <p className="py-8 text-center text-sm text-ink/55 dark:text-paper/55">companion is building your rotation...</p>
                        ) : generatedSessions.length ? (
                          <>
                            <p className="text-sm text-ink/55 dark:text-paper/55">
                              a {generatedSessions.length}-session rotation, repeating every week from{" "}
                              {DateTime.fromISO(programStartDate, { zone: profile.preferred_timezone }).toFormat("LLL d")} for {programWeeks} week
                              {programWeeks === 1 ? "" : "s"}.
                            </p>
                            <div className="grid gap-2">
                              {generatedSessions.map((session, index) => (
                                <div key={index} className="rounded-2xl border border-line bg-paper/55 p-3 dark:border-white/10 dark:bg-[#1d1d1a]">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">session {index + 1}</p>
                                  <p className="mt-1 font-semibold capitalize">{session.focus}</p>
                                  <p className="mt-1 text-sm text-ink/55 dark:text-paper/55">{session.summary}</p>
                                  <ul className="mt-2 grid gap-0.5 text-sm text-ink/70 dark:text-paper/70">
                                    {session.exercises.map((exercise, exIndex) => (
                                      <li key={exIndex}>
                                        {exercise.name} — {exercise.prescription}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>

                            <label className="flex flex-col gap-1 text-sm font-medium">
                              want changes? tell companion (e.g. "add 2 more", "make session 2 easier")
                              <div className="flex gap-2">
                                <input
                                  className="min-w-0 flex-1 rounded-full border border-line bg-white px-4 py-2 text-sm outline-none dark:border-white/15 dark:bg-[#1d1d1a]"
                                  onChange={(event) => setProgramNote(event.target.value)}
                                  placeholder="add 2 more"
                                  value={programNote}
                                />
                                <button
                                  className="shrink-0 rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-white/15"
                                  disabled={askingCompanion || !programNote.trim()}
                                  onClick={generateProgramSessions}
                                  type="button"
                                >
                                  refine
                                </button>
                              </div>
                            </label>

                            <button
                              className="w-full rounded-full bg-ink px-4 py-3 text-sm font-semibold text-paper disabled:opacity-50 dark:bg-paper dark:text-ink"
                              disabled={creatingProgram}
                              onClick={confirmProgram}
                              type="button"
                            >
                              {creatingProgram ? "adding..." : "add to calendar"}
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="py-4 text-center text-sm text-ink/55 dark:text-paper/55">could not build a rotation. try again.</p>
                            <button className="rounded-full bg-ink px-4 py-3 text-sm font-semibold text-paper dark:bg-paper dark:text-ink" onClick={generateProgramSessions} type="button">
                              retry
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          ) : selectedProject.type === "writing" ? (
            <section className="min-h-[calc(100dvh-13rem)] overflow-hidden rounded-3xl border border-line bg-white/80 shadow-soft dark:border-white/15 dark:bg-[#242420]">
              <div className="flex items-center justify-between border-b border-line px-4 py-3 dark:border-white/10">
                <div className="flex items-center gap-2 text-sm text-ink/50 dark:text-paper/50">
                  <FileText size={16} />
                  <span>{DateTime.now().setZone(profile.preferred_timezone).toFormat("cccc, LLLL d")}</span>
                </div>
                <button className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper dark:bg-paper dark:text-ink" disabled={savingEntry || (!entryTitle.trim() && !entryBody.trim())} onClick={saveWritingPage} type="button">
                  {savingEntry ? "saving..." : "done"}
                </button>
              </div>
              <div className="flex min-h-[calc(100dvh-17rem)] flex-col px-5 py-5">
                <input
                  className="w-full bg-transparent text-3xl font-semibold outline-none placeholder:text-ink/25 dark:placeholder:text-paper/25"
                  onChange={(event) => setEntryTitle(event.target.value)}
                  placeholder={selectedProject.subtype === "journal" ? "today" : "untitled"}
                  value={entryTitle}
                />
                <textarea
                  autoFocus
                  className="mt-4 min-h-[50dvh] flex-1 resize-none bg-transparent text-base leading-7 outline-none placeholder:text-ink/25 dark:placeholder:text-paper/25"
                  onChange={(event) => setEntryBody(event.target.value)}
                  placeholder="start writing..."
                  value={entryBody}
                />
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-ink/40 dark:border-white/10 dark:text-paper/40">
                  <span>{entryBody.trim() ? entryBody.trim().split(/\s+/).length : 0} words</span>
                  <span>saved inside this project</span>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-ink/35 dark:border-white/15 dark:text-paper/35">
                  <Sparkles size={16} />
                  <span className="flex-1">companion for writing isn&apos;t on yet</span>
                  <span
                    aria-label="Still figuring out how to make companion genuinely useful for creative writing, not just autocomplete."
                    className="cursor-help"
                    title="Still figuring out how to make companion genuinely useful for creative writing, not just autocomplete."
                  >
                    <Info size={15} />
                  </span>
                </div>
              </div>
            </section>
          ) : (
            <section className="grid gap-4">
              <div className="rounded-3xl border border-line bg-white/80 p-5 shadow-soft dark:border-white/15 dark:bg-[#242420]">
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">
                    {selectedProject.type === "music" ? "record a stem" : "voice memo"}
                  </p>
                  <p className="mt-3 font-mono text-5xl font-light tabular-nums">{countingIn !== null ? `in ${countingIn}` : recordedTime}</p>
                  <p className="mt-2 text-sm text-ink/45 dark:text-paper/45">
                    {countingIn !== null ? "get ready" : recording ? "recording" : audioUrl ? "ready to review" : "tap to begin"}
                  </p>
                </div>
                <div className="my-8 flex h-24 items-center justify-center gap-1 overflow-hidden" aria-hidden="true">
                  {Array.from({ length: 42 }, (_, index) => (
                    <span
                      key={index}
                      className={clsx("w-1 rounded-full transition-all", recording ? "bg-clay" : "bg-ink/15 dark:bg-paper/15")}
                      style={{ height: `${recording ? 18 + ((index * 17 + recordingSeconds * 11) % 70) : 8 + ((index * 13) % 28)}%` }}
                    />
                  ))}
                </div>

                {selectedProject.type === "music" ? (
                  <div className="mb-6 grid gap-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="border-t border-line pt-3 dark:border-white/10">
                        <p className="text-ink/45 dark:text-paper/45">tempo</p>
                        <p className="text-lg font-semibold">{String(selectedProject.settings?.bpm ?? 120)} bpm</p>
                      </div>
                      <div className="border-t border-line pt-3 dark:border-white/10">
                        <p className="text-ink/45 dark:text-paper/45">length</p>
                        <p className="text-lg font-semibold">{String(selectedProject.settings?.bars ?? 8)} bars</p>
                      </div>
                    </div>
                    <label className="flex items-center justify-between gap-3 border-t border-line pt-3 text-sm font-medium dark:border-white/10">
                      <span>metronome + count-in</span>
                      <input checked={metronomeOn} disabled={recording || countingIn !== null} onChange={(event) => setMetronomeOn(event.target.checked)} type="checkbox" />
                    </label>
                    {stemEntries.length ? (
                      <label className="flex items-center justify-between gap-3 text-sm font-medium">
                        <span>play existing stems while recording</span>
                        <input
                          checked={playStemsWhileRecording}
                          disabled={recording || countingIn !== null}
                          onChange={(event) => setPlayStemsWhileRecording(event.target.checked)}
                          type="checkbox"
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex items-center justify-center">
                  <button
                    className={clsx(
                      "grid h-20 w-20 shrink-0 place-items-center rounded-full border-[5px] border-paper shadow-[0_0_0_1px_rgba(0,0,0,.18)] dark:border-[#242420] disabled:opacity-50",
                      recording ? "bg-clay text-paper" : "bg-[#b55b48] text-paper"
                    )}
                    disabled={countingIn !== null}
                    onClick={toggleRecording}
                    aria-label={recording ? "Stop recording" : "Start recording"}
                    type="button"
                  >
                    {recording ? <Square size={22} fill="currentColor" /> : <span className="h-8 w-8 rounded-full bg-current" />}
                  </button>
                </div>
                {audioUrl ? <audio className="mt-6 w-full" controls src={audioUrl} /> : null}
              </div>

              {audioUrl ? (
                <div className="rounded-3xl border border-line bg-white/80 p-4 shadow-soft dark:border-white/15 dark:bg-[#242420]">
                  <input
                    className="w-full bg-transparent text-xl font-semibold outline-none placeholder:text-ink/25 dark:placeholder:text-paper/25"
                    onChange={(event) => setEntryTitle(event.target.value)}
                    placeholder={selectedProject.type === "music" ? "take name" : "voice memo"}
                    value={entryTitle}
                  />
                  {selectedProject.type === "music" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["vocals", "guitar", "keyboard", "bass", "drums", "other"].map((option) => (
                        <button
                          key={option}
                          className={clsx(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition",
                            instrument === option
                              ? "border-ink bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink"
                              : "border-line text-ink/60 dark:border-white/15 dark:text-paper/60"
                          )}
                          onClick={() => setInstrument(option)}
                          type="button"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <textarea
                    className="mt-3 min-h-24 w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-ink/25 dark:placeholder:text-paper/25"
                    onChange={(event) => setEntryBody(event.target.value)}
                    placeholder="add a note..."
                    value={entryBody}
                  />
                  <button
                    className="mt-3 w-full rounded-full bg-ink px-4 py-3 font-semibold text-paper disabled:opacity-50 dark:bg-paper dark:text-ink"
                    disabled={savingEntry || recording}
                    onClick={saveAudioNote}
                    type="button"
                  >
                    {savingEntry ? "saving..." : selectedProject.type === "music" ? "save stem" : "save recording"}
                  </button>
                </div>
              ) : null}

              {selectedProject.type === "music" && stemEntries.length ? (
                <div className="rounded-3xl border border-line bg-white/80 p-4 shadow-soft dark:border-white/15 dark:bg-[#242420]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">stems · {stemEntries.length}</p>
                    <button
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold dark:border-white/15"
                      onClick={playAllStems}
                      type="button"
                    >
                      <Play size={12} /> play all together
                    </button>
                  </div>
                  <div className="grid gap-3">
                    {stemEntries.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-line bg-paper/55 p-3 dark:border-white/10 dark:bg-[#1d1d1a]">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate font-semibold">{entry.title}</span>
                          <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase text-ink/55 dark:border-white/15 dark:text-paper/55">
                            {String(entry.metadata?.instrument ?? "other")}
                          </span>
                          {entry.owner_id === profile.id ? (
                            <button className="shrink-0 text-ink/35 dark:text-paper/35" onClick={() => deleteProjectEntry(entry)} type="button" aria-label={`Delete ${entry.title}`}>
                              <Trash2 size={14} />
                            </button>
                          ) : null}
                        </div>
                        {entry.media_url ? <audio className="w-full" controls src={entry.media_url} /> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedProject.type !== "music" && voiceMemoEntries.length ? (
                <div className="rounded-3xl border border-line bg-white/80 p-4 shadow-soft dark:border-white/15 dark:bg-[#242420]">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-clay">recordings · {voiceMemoEntries.length}</p>
                  <div className="grid gap-3">
                    {voiceMemoEntries.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-line bg-paper/55 p-3 dark:border-white/10 dark:bg-[#1d1d1a]">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate font-semibold">{entry.title}</span>
                          {entry.owner_id === profile.id ? (
                            <button className="shrink-0 text-ink/35 dark:text-paper/35" onClick={() => deleteProjectEntry(entry)} type="button" aria-label={`Delete ${entry.title}`}>
                              <Trash2 size={14} />
                            </button>
                          ) : null}
                        </div>
                        {entry.body ? <p className="mb-2 whitespace-pre-wrap text-sm text-ink/65 dark:text-paper/65">{entry.body}</p> : null}
                        {entry.media_url ? <audio className="w-full" controls src={entry.media_url} /> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          )}

          <section className="grid gap-3">
            {entriesLoading ? <p className="text-sm text-ink/55 dark:text-paper/55">Loading project entries...</p> : null}
            {logEntries.map((entry) => (
              <article key={entry.id} className="rounded-3xl border border-white/70 bg-white/85 p-4 shadow-soft dark:border-white/15 dark:bg-[#242420]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45 dark:text-paper/40">
                    {DateTime.fromISO(entry.occurred_at).setZone(profile.preferred_timezone).toFormat("LLL d, h:mm a")}
                  </p>
                  {entry.owner_id === profile.id ? (
                    <button className="text-ink/35 transition hover:text-clay dark:text-paper/35" onClick={() => deleteProjectEntry(entry)} type="button" aria-label={`Delete ${entry.title}`}>
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </div>
                <h3 className="mt-1 font-semibold">{entry.title}</h3>
                {entry.body ? <p className="mt-2 whitespace-pre-wrap text-sm text-ink/65 dark:text-paper/65">{entry.body}</p> : null}
              </article>
            ))}
          </section>
        </section>
      ) : !creating && projects.length === 0 ? (
        <EmptyPanel title="No projects yet" body="Create a project for fitness, writing, or audio." />
      ) : null}
    </section>
  );
}

function CalendarView({
  allEvents,
  calendarGroup,
  calendarGroupId,
  eventToOpenId,
  events,
  groups,
  loggedWorkoutEventIds,
  notifyGroupMembers,
  onOpenWorkoutLog,
  onResetWorkout,
  profile,
  projects,
  reload,
  selectedDayEvents,
  selectedDate,
  setCalendarGroupId,
  setEventToOpenId,
  setMessage,
  setSelectedDate,
  setView,
  timezone,
  viewerWeatherByEventId,
  view
}: {
  allEvents: EventItem[];
  calendarGroup: Group | null;
  calendarGroupId: string;
  eventToOpenId: string | null;
  events: EventItem[];
  groups: Group[];
  loggedWorkoutEventIds: Set<string>;
  notifyGroupMembers: (groupId: string, message: string, metadata?: Record<string, unknown>) => Promise<void>;
  onOpenWorkoutLog: (eventId: string) => void;
  onResetWorkout: (event: EventItem) => void;
  profile: Profile;
  projects: ProjectItem[];
  reload: WorkspaceReload;
  selectedDayEvents: EventItem[];
  selectedDate: string;
  setCalendarGroupId: (id: string) => void;
  setEventToOpenId: (id: string | null) => void;
  setMessage: (value: string) => void;
  setSelectedDate: (value: string) => void;
  setView: (view: ViewMode) => void;
  timezone: string;
  viewerWeatherByEventId: Record<string, EventWeather>;
  view: ViewMode;
}) {
  const writableGroup = calendarGroup ?? groups[0] ?? null;
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [projectFilterId, setProjectFilterId] = useState("all");
  const fitnessProjectIds = new Set(projects.filter((project) => project.type === "fitness").map((project) => project.id));
  const eventProjectIds = [...new Set(events.map((event) => event.project_id).filter((id): id is string => Boolean(id)))];
  const projectFilterOptions = eventProjectIds
    .map((id) => projects.find((project) => project.id === id))
    .filter((project): project is ProjectItem => Boolean(project));
  const filteredEvents = projectFilterId === "all" ? events : events.filter((event) => event.project_id === projectFilterId);
  const filteredSelectedDayEvents =
    projectFilterId === "all" ? selectedDayEvents : selectedDayEvents.filter((event) => event.project_id === projectFilterId);
  const [exportGroupId, setExportGroupId] = useState(calendarGroupId);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [eventGroupId, setEventGroupId] = useState(calendarGroupId === "all" ? "personal" : calendarGroupId);
  const editingEvent = editingEventId ? allEvents.find((event) => event.id === editingEventId) ?? null : null;
  const editableGroups = groups.filter((group) => group.role === "owner" || group.role === "editor");
  const exportGroup = groups.find((group) => group.id === exportGroupId) ?? null;
  const exportBaseEvents =
    exportGroupId === "all"
      ? allEvents
      : exportGroupId === "personal"
        ? allEvents.filter((event) => !event.group_id && (event.owner_id ?? event.creator_id) === profile.id)
        : allEvents.filter((event) => event.group_id === exportGroupId);
  const exportLabel = exportGroupId === "personal" ? "Personal" : exportGroup?.name ?? "All groups";
  const exportStart = exportStartDate ? DateTime.fromISO(exportStartDate, { zone: timezone }).startOf("day") : null;
  const exportEnd = exportEndDate ? DateTime.fromISO(exportEndDate, { zone: timezone }).endOf("day") : null;
  const exportEvents = exportBaseEvents.filter((event) => {
    const eventTime = localDateTime(event, timezone);
    if (exportStart?.isValid && eventTime.toMillis() < exportStart.toMillis()) return false;
    if (exportEnd?.isValid && eventTime.toMillis() > exportEnd.toMillis()) return false;
    return true;
  });
  const exportRangeLabel =
    exportStartDate || exportEndDate
      ? `${exportStartDate ? DateTime.fromISO(exportStartDate).toFormat("LLL d, yyyy") : "Start"} to ${exportEndDate ? DateTime.fromISO(exportEndDate).toFormat("LLL d, yyyy") : "End"}`
      : "All dates";
  const formGroup =
    eventGroupId === "personal"
      ? null
      : groups.find((group) => group.id === eventGroupId) ??
    (editingEvent?.group_id ? groups.find((group) => group.id === editingEvent.group_id) : null) ??
    writableGroup;

  useEffect(() => {
    if (eventModalOpen || editingEvent) return;
    setEventGroupId(calendarGroupId === "all" ? "personal" : calendarGroupId);
  }, [calendarGroupId, eventModalOpen, editingEvent]);

  useEffect(() => {
    if (exportModalOpen) return;
    setExportGroupId(calendarGroupId);
  }, [calendarGroupId, exportModalOpen]);

  useEffect(() => {
    setProjectFilterId("all");
  }, [calendarGroupId]);

  useEffect(() => {
    if (!eventToOpenId) return;
    const event = allEvents.find((item) => item.id === eventToOpenId);
    if (!event) return;
    setSelectedDate(localDateTime(event, timezone).toISODate() ?? selectedDate);
    setCalendarGroupId(event.group_id ?? "personal");
    setEventToOpenId(null);
  }, [allEvents, eventToOpenId, selectedDate, setCalendarGroupId, setEventToOpenId, setSelectedDate, timezone]);

  function openAddEvent(date = selectedDate) {
    setEditingEventId(null);
    setEventGroupId(calendarGroupId === "all" ? "personal" : calendarGroupId);
    setSelectedDate(date);
    setEventModalOpen(true);
  }

  function closeEventModal() {
    setEditingEventId(null);
    setEventModalOpen(false);
  }

  function exportIcs() {
    downloadCalendarIcs(exportEvents, `connection-${exportLabel}-${exportRangeLabel}`);
    setExportModalOpen(false);
    setMessage("Calendar exported.");
  }

  function exportPdf() {
    downloadCalendarPdf({ events: exportEvents, groups, label: exportLabel, profile, rangeLabel: exportRangeLabel, timezone });
    setExportModalOpen(false);
    setMessage("Calendar exported.");
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
    const eventGroup = event.group_id ? groups.find((group) => group.id === event.group_id) : null;
    const eventDate = localDateTime(event, profile.preferred_timezone).toISODate() ?? selectedDate;
    if (event.group_id) {
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
    }
    await reload();
    setMessage("Calendar event deleted successfully.");
  }

  return (
    <section className="flex flex-col gap-4">
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

      <div className="flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Calendar</span>
          <select
            className="h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm font-semibold text-ink outline-none transition focus:border-ink dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper dark:focus:border-paper"
            onChange={(event) => setCalendarGroupId(event.target.value)}
            value={calendarGroupId}
          >
            <option value="personal">Personal</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
            <option value="all">All groups</option>
          </select>
        </label>
        <button
          className="shrink-0 rounded-full border border-line bg-paper px-4 py-2 text-sm font-semibold text-ink dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
          onClick={() => {
            setExportGroupId(calendarGroupId);
            setExportModalOpen(true);
          }}
          type="button"
        >
          Export
        </button>
      </div>

      {projectFilterOptions.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            className={clsx(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              projectFilterId === "all"
                ? "border-ink bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink"
                : "border-line text-ink/60 dark:border-white/15 dark:text-paper/60"
            )}
            onClick={() => setProjectFilterId("all")}
            type="button"
          >
            All
          </button>
          {projectFilterOptions.map((project) => (
            <button
              key={project.id}
              className={clsx(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                projectFilterId === project.id
                  ? "border-ink bg-ink text-paper dark:border-paper dark:bg-paper dark:text-ink"
                  : "border-line text-ink/60 dark:border-white/15 dark:text-paper/60"
              )}
              onClick={() => setProjectFilterId(project.id)}
              type="button"
            >
              {project.name} · {(project.subtype ?? project.type).replaceAll("_", " ")}
            </button>
          ))}
        </div>
      ) : null}

      <CalendarSurface
        canCreateEvent={Boolean(profile)}
        events={filteredEvents}
        onCreateEvent={(date) => openAddEvent(date)}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        timezone={timezone}
        view={view}
      />

      <div className="grid gap-4">
        <EventList
          editableGroups={editableGroups.map((group) => group.id)}
          emptyBody={calendarGroupId === "personal" ? "Double-tap a calendar day to add a personal plan." : "Double-tap a calendar day to add a shared plan."}
          events={filteredSelectedDayEvents}
          fitnessProjectIds={fitnessProjectIds}
          loggedWorkoutEventIds={loggedWorkoutEventIds}
          onDelete={(event) => void deleteEvent(event)}
          onEdit={(event) => {
            if (event.project_id && fitnessProjectIds.has(event.project_id)) {
              onOpenWorkoutLog(event.id);
              return;
            }
            setCalendarGroupId(event.group_id ?? "personal");
            setEditingEventId(event.id);
            setEventGroupId(event.group_id ?? "personal");
            setEventModalOpen(true);
          }}
          onResetWorkout={onResetWorkout}
          timezone={timezone}
          viewerWeatherByEventId={viewerWeatherByEventId}
        />
      </div>
      {eventModalOpen && (eventGroupId === "personal" || formGroup) ? (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/45 px-3 pt-[calc(5.75rem+env(safe-area-inset-top))] text-ink backdrop-blur-sm dark:bg-black/55"
          onClick={closeEventModal}
        >
          <EventForm
            editingEvent={editingEvent}
            group={eventGroupId === "personal" ? null : formGroup}
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
      {exportModalOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/45 px-3 pt-[calc(7rem+env(safe-area-inset-top))] text-ink backdrop-blur-sm dark:bg-black/60"
          onClick={() => setExportModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/70 bg-white p-4 shadow-soft dark:border-white/15 dark:bg-[#242420] dark:text-paper"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Export calendar</h2>
                <p className="mt-1 text-sm text-ink/60 dark:text-paper/55">{exportLabel} · {exportEvents.length} of {exportBaseEvents.length} event{exportBaseEvents.length === 1 ? "" : "s"}</p>
              </div>
              <button
                aria-label="Close export"
                className="grid h-9 w-9 place-items-center rounded-full border border-line dark:border-white/15"
                onClick={() => setExportModalOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mb-4 grid gap-2">
              <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/45 dark:text-paper/40">
                Group
                <select
                  className="min-w-0 rounded-xl border border-line bg-paper px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink outline-none dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
                  onChange={(event) => setExportGroupId(event.target.value)}
                  value={exportGroupId}
                >
                  <option value="all">All groups</option>
                  <option value="personal">Personal</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
              <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/45 dark:text-paper/40">
                From
                <input
                  className="min-w-0 rounded-xl border border-line bg-paper px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink outline-none dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
                  onChange={(event) => setExportStartDate(event.target.value)}
                  type="date"
                  value={exportStartDate}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/45 dark:text-paper/40">
                To
                <input
                  className="min-w-0 rounded-xl border border-line bg-paper px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink outline-none dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
                  onChange={(event) => setExportEndDate(event.target.value)}
                  type="date"
                  value={exportEndDate}
                />
              </label>
              </div>
              {exportStartDate || exportEndDate ? (
                <button
                  className="justify-self-start text-sm font-semibold text-ink/55 dark:text-paper/55"
                  onClick={() => {
                    setExportStartDate("");
                    setExportEndDate("");
                  }}
                  type="button"
                >
                  Clear range
                </button>
              ) : null}
            </div>
            <div className="grid gap-2">
              <button
                className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-left font-semibold dark:border-white/15"
                onClick={exportIcs}
                type="button"
              >
                <span>ICS calendar</span>
                <Download size={17} />
              </button>
              <button
                className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-left font-semibold dark:border-white/15"
                onClick={exportPdf}
                type="button"
              >
                <span>PDF collection</span>
                <Download size={17} />
              </button>
            </div>
          </div>
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
    ["projects", "Projects", <FolderOpen key="projects" size={18} />],
    ["gallery", "Gallery", <ImageIcon key="gallery" size={18} />],
    ["profile", "Profile", <User key="profile" size={18} />]
  ];

  return (
    <nav className="app-bottom-nav fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/92 px-3 pt-2 backdrop-blur dark:border-white/15 dark:bg-[#1d1d1a]/95">
      <div className="mx-auto grid max-w-lg grid-cols-6 gap-1">
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
  canDelete,
  canEdit,
  canOpenOwner,
  onOpenOwner,
  onDelete,
  onEditCaption,
  onShare,
  onExitContext,
  photo,
  photos,
  setSelectedPhotoId
}: {
  canDelete: boolean;
  canEdit: boolean;
  canOpenOwner: boolean;
  onOpenOwner: (photo: PhotoItem) => void;
  onDelete: (photo: PhotoItem) => void;
  onEditCaption: (photo: PhotoItem, caption: string) => Promise<boolean>;
  onShare: (photo: PhotoItem) => Promise<void>;
  onExitContext: () => void;
  photo: PhotoItem;
  photos: PhotoItem[];
  setSelectedPhotoId: (id: string | null) => void;
}) {
  const currentIndex = Math.max(0, photos.findIndex((item) => item.id === photo.id));
  const previousPhoto = currentIndex > 0 ? photos[currentIndex - 1] : null;
  const nextPhoto = currentIndex < photos.length - 1 ? photos[currentIndex + 1] : null;
  const showLoveBurst = photo.id === specialLovePhotoId;
  const [captionDraft, setCaptionDraft] = useState(photo.caption);
  const [captionEditorOpen, setCaptionEditorOpen] = useState(false);
  const [heartBurstKey, setHeartBurstKey] = useState(0);
  const [imageReady, setImageReady] = useState(false);
  const lastHeartTapRef = useRef(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setCaptionDraft(photo.caption);
    setCaptionEditorOpen(false);
    setImageReady(false);
  }, [photo.caption, photo.id]);

  useEffect(() => {
    [previousPhoto, nextPhoto].forEach((nearbyPhoto) => {
      if (!nearbyPhoto) return;
      const image = new window.Image();
      image.src = nearbyPhoto.src;
    });
  }, [nextPhoto?.src, previousPhoto?.src]);

  function triggerHeartBurst() {
    setHeartBurstKey(Date.now());
  }

  function handlePhotoTap() {
    const now = Date.now();
    if (now - lastHeartTapRef.current < 320) {
      triggerHeartBurst();
      lastHeartTapRef.current = 0;
      return;
    }
    lastHeartTapRef.current = now;
  }

  const finishSwipe = (x: number, y: number) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;

    const deltaX = x - start.x;
    const deltaY = y - start.y;
    if (deltaY > 82 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
      onExitContext();
      return;
    }
    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    if (deltaX < 0) {
      if (nextPhoto) setSelectedPhotoId(nextPhoto.id);
      else onExitContext();
    }
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
      <div className="flex items-center justify-between px-4 pb-3 pt-[calc(0.9rem+env(safe-area-inset-top))]">
        <button className="text-sm font-medium" onClick={() => setSelectedPhotoId(null)} type="button">
          Back
        </button>
        <p className="text-sm font-semibold">{currentIndex + 1} / {photos.length}</p>
        {canDelete ? (
          <div className="flex h-9 items-center justify-end gap-1">
            <button
              aria-label="Copy keepsake link"
              className="grid h-9 w-9 place-items-center"
              onClick={() => void onShare(photo)}
              title="Copy keepsake link"
              type="button"
            >
              <HeartHandshake size={18} strokeWidth={1.9} />
            </button>
            <button
              aria-label="Delete photo"
              className="grid h-9 w-9 place-items-center"
              onClick={() => onDelete(photo)}
              type="button"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ) : (
          <span aria-hidden="true" className="h-9 w-[4.75rem]" />
        )}
      </div>
      <div
        className="relative min-h-0 flex-1 bg-black"
        onClick={(event) => {
          if (event.target instanceof HTMLElement && event.target.closest("button")) return;
          handlePhotoTap();
        }}
      >
        {!imageReady ? (
          <div className="absolute inset-0 grid place-items-center bg-black text-xs uppercase tracking-[0.18em] text-paper/35">
            loading
          </div>
        ) : null}
        <img
          key={photo.id}
          alt={photo.title}
          className={clsx("h-full w-full object-contain transition-opacity duration-150", imageReady ? "opacity-100" : "opacity-0")}
          src={photo.src}
          onLoad={() => setImageReady(true)}
        />

        {heartBurstKey ? (
          <span key={heartBurstKey} className="viewer-heart-burst" aria-hidden="true">
            ❤️
          </span>
        ) : null}
        {showLoveBurst ? (
          <div key={photo.id} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {loveHeartParticles.map((heart, index) => (
              <span
                key={`${photo.id}-${index}`}
                className="love-heart"
                style={{
                  left: `${heart.left}%`,
                  animationDelay: `${heart.delay}s`,
                  animationDuration: `${heart.duration}s`,
                  fontSize: `${heart.size}rem`
                }}
              >
                ❤️
              </span>
            ))}
          </div>
        ) : null}
        {previousPhoto ? (
          <button
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-3xl"
            onClick={() => setSelectedPhotoId(previousPhoto.id)}
          >
            ‹
          </button>
        ) : null}
        {photos.length > 1 ? (
          <button
            aria-label={nextPhoto ? "Next photo" : "Exit photo feed"}
            className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-3xl"
            onClick={() => (nextPhoto ? setSelectedPhotoId(nextPhoto.id) : onExitContext())}
          >
            ›
          </button>
        ) : null}

      </div>
      <div className="relative z-10 h-[calc(10rem+env(safe-area-inset-bottom))] shrink-0 border-t border-white/10 bg-[#1d1d1a] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-paper">
        <div className="flex items-start justify-between gap-3">
          <button
            className={clsx(
              "min-w-0 flex-1 text-left",
              canOpenOwner ? "transition hover:opacity-75" : "cursor-default"
            )}
            disabled={!canOpenOwner}
            onClick={() => onOpenOwner(photo)}
            type="button"
          >
            <div className="flex items-center gap-3">
              <Avatar name={photo.owner} src={photo.ownerAvatar} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{photo.owner}</p>
                <p className="truncate text-xs text-paper/55">{photoTime(photo)}</p>
              </div>
            </div>
            {photo.location ? <p className="mt-2 truncate text-xs text-paper/50">{photo.location}</p> : null}
            {photo.caption ? <p className="mt-3 line-clamp-2 text-base font-medium leading-6">{photo.caption}</p> : null}
          </button>
          {canEdit ? (
            <button
              aria-label="Edit caption"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-paper/80"
              onClick={() => setCaptionEditorOpen(true)}
              type="button"
            >
              <Pencil size={16} />
            </button>
          ) : null}
        </div>

        {captionEditorOpen ? (
          <div className="absolute inset-x-3 bottom-[calc(100%+0.75rem)] rounded-xl border border-white/20 bg-ink/95 p-3 text-paper shadow-soft">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Caption
              <textarea
                autoFocus
                className="min-h-24 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-base text-paper outline-none focus:border-white"
                value={captionDraft}
                onChange={(event) => setCaptionDraft(event.target.value)}
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                className="flex-1 rounded-full bg-paper px-4 py-2 font-medium text-ink"
                onClick={() =>
                  void onEditCaption(photo, captionDraft).then((saved) => {
                    if (saved) setCaptionEditorOpen(false);
                  })
                }
                type="button"
              >
                Save
              </button>
              <button
                className="flex-1 rounded-full border border-white/15 px-4 py-2 font-medium"
                onClick={() => {
                  setCaptionDraft(photo.caption);
                  setCaptionEditorOpen(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SharePhotoSheet({
  groups,
  initialTarget,
  photoUploading,
  src,
  onCancel,
  onShare
}: {
  groups: Group[];
  initialTarget: ShareTarget;
  photoUploading: boolean;
  src: string;
  onCancel: () => void;
  onShare: (target: ShareTarget, caption: string) => void;
}) {
  const [caption, setCaption] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<ShareTarget>(initialTarget);
  const selectedKey = selectedTarget.type === "group" ? `group:${selectedTarget.groupId}` : "connections";
  const destinationOptions = [
    { label: "All connections", value: "connections" },
    ...groups.map((group) => ({ label: group.name, value: `group:${group.id}` }))
  ];

  function updateDestination(value: string) {
    if (value === "connections") {
      setSelectedTarget({ type: "connections" });
      return;
    }
    const groupId = value.replace("group:", "");
    setSelectedTarget({ type: "group", groupId });
  }

  return (
    <div className="fixed inset-0 z-40 bg-white text-ink dark:bg-[#151512] dark:text-paper">
      <section className="mx-auto flex h-full w-full max-w-xl flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">New photo</h2>
            <p className="text-sm text-ink/55 dark:text-paper/55">Add a caption and choose where it lives.</p>
          </div>
          <button className="text-sm text-ink/60 dark:text-paper/60" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>

        <div className="mb-4 flex min-h-0 flex-1 items-center justify-center bg-paper dark:bg-[#1d1d1a]">
          <img alt="Captured preview" className="max-h-full max-w-full object-contain" src={src} />
        </div>

        <textarea
          className="mb-3 min-h-20 w-full rounded-lg border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-moss dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
          placeholder="Add a caption"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          disabled={photoUploading}
        />

        <select
          aria-label="Photo destination"
          className="mb-3 rounded-full border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-moss disabled:opacity-50 dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
          disabled={photoUploading}
          value={selectedKey}
          onChange={(event) => updateDestination(event.target.value)}
        >
          {destinationOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          className="w-full rounded-full bg-ink px-4 py-3 font-medium text-paper transition disabled:opacity-45 dark:bg-paper dark:text-ink"
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
  connectionNotifications,
  connectionRequests,
  groupNotifications,
  invites,
  onAcceptConnection,
  onAcceptGroup,
  onDeclineConnection,
  onDeclineGroup,
  onClearAll,
  onOpenConnectionNotification,
  onOpenGroupNotification,
  timezone
}: {
  connectionNotifications: ConnectionNotification[];
  connectionRequests: ConnectionRequest[];
  groupNotifications: GroupNotification[];
  invites: GroupInvite[];
  onAcceptConnection: (requesterId: string) => void;
  onAcceptGroup: (token: string) => void;
  onDeclineConnection: (requesterId: string) => void;
  onDeclineGroup: (token: string) => void;
  onClearAll: () => void;
  onOpenConnectionNotification: (notification: ConnectionNotification) => void;
  onOpenGroupNotification: (notification: GroupNotification) => void;
  timezone: string;
}) {
  const unreadGroupNotifications = groupNotifications.filter((notification) => !notification.readAt);
  const unreadConnectionNotifications = connectionNotifications.filter((notification) => !notification.readAt);
  const unreadNotificationCount = unreadGroupNotifications.length + unreadConnectionNotifications.length;
  const total = invites.length + connectionRequests.length + unreadGroupNotifications.length + unreadConnectionNotifications.length;
  const hasHistory = Boolean(groupNotifications.length || connectionNotifications.length);
  const notificationItems = [
    ...groupNotifications.map((notification) => ({
      id: `group:${notification.id}`,
      createdAt: notification.createdAt,
      kind: "group" as const,
      notification
    })),
    ...connectionNotifications.map((notification) => ({
      id: `connection:${notification.id}`,
      createdAt: notification.createdAt,
      kind: "connection" as const,
      notification
    })),
    ...connectionRequests.map((request) => ({
      id: `request:${request.requesterId}`,
      createdAt: request.createdAt,
      kind: "request" as const,
      request
    })),
    ...invites.map((invite) => ({
      id: `invite:${invite.id}`,
      createdAt: invite.createdAt,
      kind: "invite" as const,
      invite
    }))
  ].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));

  return (
    <section className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] top-[5.25rem] z-20 flex flex-col rounded-lg border border-line bg-white p-4 text-left shadow-soft dark:border-white/15 dark:bg-[#242420] sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-12 sm:w-[min(23rem,calc(100vw-2rem))] sm:max-h-[min(34rem,calc(100dvh-7rem))]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Notifications</h2>
        {total ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink/55 dark:text-paper/55">{total} pending</span>
            {unreadNotificationCount ? (
              <button
                className="rounded-full border border-line px-2 py-1 text-[0.65rem] font-medium text-ink/55 transition hover:text-ink dark:border-white/15 dark:text-paper/55 dark:hover:text-paper"
                onClick={(event) => {
                  event.stopPropagation();
                  onClearAll();
                }}
                type="button"
              >
                Clear all
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {total || hasHistory ? (
        <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto pr-1 sm:max-h-[min(32rem,calc(100dvh-9rem))]">
          {notificationItems.map((item) => {
            if (item.kind === "group") {
              const { notification } = item;
              const summary = groupNotificationSummary(notification, timezone);
              const actionStyle = calendarNotificationStyle(notification);
              return (
                <button
                  key={item.id}
                  className={clsx(
                    "rounded-lg border p-3 text-left transition hover:border-ink/25 hover:bg-white dark:border-white/15 dark:hover:border-paper/25 dark:hover:bg-[#242420]",
                    notification.readAt
                      ? "border-line bg-white dark:bg-[#1d1d1a]"
                      : "border-moss/40 bg-skysoft/55 dark:bg-[#202923]",
                    actionStyle.card
                  )}
                  onClick={() => onOpenGroupNotification(notification)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{notification.groupName}</p>
                    </div>
                    <p className="shrink-0 pt-0.5 text-[0.58rem] uppercase tracking-[0.12em] text-ink/35 dark:text-paper/35">
                      {notificationTime(notification.createdAt)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-ink/60 dark:text-paper/60">{notification.message}</p>
                  {summary ? (
                    <p className={clsx("mt-2 rounded-md px-2 py-1.5 text-xs font-semibold leading-5 shadow-sm", actionStyle.summary)}>
                      {summary}
                    </p>
                  ) : null}
                </button>
              );
            }

            if (item.kind === "connection") {
              const { notification } = item;
              return (
                <button
                  key={item.id}
                  className={clsx(
                    "rounded-lg border p-3 text-left transition hover:border-ink/25 hover:bg-white dark:border-white/15 dark:hover:border-paper/25 dark:hover:bg-[#242420]",
                    notification.readAt
                      ? "border-line bg-white dark:bg-[#1d1d1a]"
                      : "border-moss/40 bg-skysoft/55 dark:bg-[#202923]"
                  )}
                  onClick={() => onOpenConnectionNotification(notification)}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={notification.actorName} src={notification.actorAvatarUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{notification.actorName}</p>
                      <p className="mt-0.5 text-[0.68rem] uppercase tracking-[0.14em] text-ink/35 dark:text-paper/35">
                        {notificationTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-ink/60 dark:text-paper/60">{notification.message}</p>
                </button>
              );
            }

            if (item.kind === "request") {
              const { request } = item;
              return (
                <article key={item.id} className="rounded-lg border border-line bg-paper p-3 dark:border-white/15 dark:bg-[#1d1d1a]">
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
              );
            }

            const { invite } = item;
            return (
              <article key={item.id} className="rounded-lg border border-line bg-paper p-3 dark:border-white/15 dark:bg-[#1d1d1a]">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{invite.groupName}</p>
                  <p className="text-[0.68rem] uppercase tracking-[0.14em] text-ink/35 dark:text-paper/35">
                    {notificationTime(invite.createdAt)}
                  </p>
                </div>
                <p className="mt-1 text-xs leading-5 text-ink/60 dark:text-paper/60">
                  {invite.inviterName} invited you as {groupRoleLabel(invite.role)}.
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
            );
          })}
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
      <section className="w-full max-w-sm rounded-lg bg-white p-5 shadow-soft dark:bg-[#242420] dark:text-paper">
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

function parseWorkoutDescription(description: string | null) {
  return (description ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) return { name: line, prescription: "" };
      return { name: line.slice(0, separatorIndex).trim(), prescription: line.slice(separatorIndex + 1).trim() };
    });
}

function WorkoutLogSheet({
  event,
  getAuthHeaders,
  onClose,
  onLogged,
  profile,
  setMessage
}: {
  event: EventItem | null;
  getAuthHeaders: (options?: { refresh?: boolean }) => Promise<{ Authorization: string } | null>;
  onClose: () => void;
  onLogged: () => void;
  profile: Profile;
  setMessage: (value: string) => void;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [started, setStarted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const exercises = event ? parseWorkoutDescription(event.description) : [];

  useEffect(() => {
    setStarted(false);
    setElapsedSeconds(0);
    setChecked([]);
  }, [event?.id]);

  useEffect(() => {
    if (!started) return;
    const timer = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [started]);

  if (!event) return null;

  function toggle(name: string) {
    setChecked((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  }

  async function logWorkout() {
    if (!event || saving) return;
    const headers = await getAuthHeaders();
    if (!headers || !event.project_id) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/projects/${event.project_id}/entries`, {
        body: JSON.stringify({
          body: event.description ?? "",
          kind: "workout",
          metadata: { checkedExercises: checked, durationSeconds: elapsedSeconds, loggedFromEventId: event.id },
          occurredAt: event.starts_at_utc,
          title: event.title
        }),
        headers: { ...headers, "content-type": "application/json" },
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Could not log this workout.");
        return;
      }
      setMessage("Workout logged.");
      onLogged();
    } finally {
      setSaving(false);
    }
  }

  const stopwatch = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  return (
    <div className="session-fullscreen-in fixed inset-0 z-50 flex flex-col bg-paper text-ink dark:bg-[#151515] dark:text-paper">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] dark:border-white/10">
        <button
          aria-label="Exit without finishing"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line dark:border-white/15"
          onClick={onClose}
          type="button"
        >
          <X size={18} />
        </button>
        <div className="flex items-center gap-2 rounded-full border border-line bg-white/70 px-4 py-1.5 font-mono text-lg font-semibold tabular-nums dark:border-white/15 dark:bg-white/5">
          <Clock3 className="text-clay" size={16} />
          {stopwatch}
        </div>
        <button
          aria-label="Finish session"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-paper disabled:opacity-30 dark:bg-paper dark:text-ink"
          disabled={saving || !started}
          onClick={logWorkout}
          type="button"
        >
          {saving ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle2 size={20} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-clay">
          {DateTime.fromISO(event.starts_at_utc).setZone(profile.preferred_timezone).toFormat("cccc, LLL d · h:mm a")}
        </p>
        <h2 className="mt-1 text-3xl font-semibold capitalize">{event.title}</h2>

        {!started ? (
          <div className="mt-8 flex flex-col items-center gap-5 text-center">
            <p className="text-sm text-ink/55 dark:text-paper/55">
              {exercises.length ? `${exercises.length} exercise${exercises.length === 1 ? "" : "s"} planned` : "no session details on this event"}
            </p>
            <button
              className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-full bg-ink text-paper shadow-soft dark:bg-paper dark:text-ink"
              onClick={() => setStarted(true)}
              type="button"
            >
              <Play fill="currentColor" size={26} />
              <span className="text-sm font-semibold">start</span>
            </button>
            <p className="text-xs text-ink/40 dark:text-paper/40">the timer starts once you tap start</p>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink/50 dark:text-paper/50">
              {checked.length}/{exercises.length} done
            </p>
            {exercises.length ? (
              <div className="mt-5 grid gap-2">
                {exercises.map((exercise, index) => {
                  const key = `${exercise.name}-${index}`;
                  const done = checked.includes(key);
                  return (
                    <button
                      key={key}
                      className="flex items-center gap-3 rounded-2xl border border-line bg-paper/70 p-4 text-left dark:border-white/10 dark:bg-[#1d1d1a]"
                      onClick={() => toggle(key)}
                      type="button"
                    >
                      <span
                        className={clsx(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2",
                          done ? "border-clay bg-clay text-paper" : "border-line dark:border-white/20"
                        )}
                      >
                        {done ? <Check size={16} /> : null}
                      </span>
                      <span className={clsx("min-w-0", done && "opacity-45")}>
                        <span className={clsx("block truncate font-semibold capitalize", done && "line-through")}>{exercise.name}</span>
                        {exercise.prescription ? <span className="text-sm text-ink/50 dark:text-paper/50">{exercise.prescription}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-5 rounded-2xl border border-dashed border-line p-5 text-center text-sm text-ink/45 dark:border-white/15 dark:text-paper/45">
                no session details on this event
              </p>
            )}
          </>
        )}
      </div>
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
        "select-none text-center font-semibold tracking-normal text-ink dark:text-paper",
        compact ? "text-xl leading-none sm:text-2xl" : "text-3xl",
        className
      )}
      aria-label="Connection"
    >
      Connection
    </div>
  );
}

function AboutConnectionModal({
  onClose,
  onCopyBetaLink
}: {
  onClose: () => void;
  onCopyBetaLink: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/25 px-4 pt-[calc(5.75rem+env(safe-area-inset-top))] text-ink backdrop-blur-sm dark:bg-black/55 dark:text-paper"
      onClick={onClose}
    >
      <section
        className="w-full max-w-sm rounded-xl border border-line bg-white p-5 shadow-soft dark:border-white/15 dark:bg-[#242420]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-[#4aaad0] dark:text-[#8ed8f5]">Beta</p>
            <h2 className="mt-2 text-2xl font-semibold leading-none">Connection</h2>
            <p className="mt-2 text-sm text-ink/60 dark:text-paper/60">{betaVersionName} · v{appVersion}</p>
          </div>
          <button
            aria-label="Close about Connection"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-ink/70 dark:border-white/15 dark:text-paper/70"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 space-y-3 border-y border-line py-4 text-sm leading-6 text-ink/70 dark:border-white/10 dark:text-paper/65">
          <p>Private photos, tiny updates, and an intimate calendar for the people closest to you.</p>
          <p className="text-xs uppercase tracking-[0.18em] text-ink/45 dark:text-paper/40">Early preview build</p>
        </div>

        <a
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5 dark:border-white/15 dark:text-paper"
          href="/beta"
          onClick={onClose}
        >
          <Info size={15} />
          What this is + what&apos;s next
        </a>

        <button
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 dark:bg-paper dark:text-ink"
          onClick={onCopyBetaLink}
          type="button"
        >
          <Link2 size={16} />
          Share beta link
        </button>
      </section>
    </div>
  );
}

function AuthScreen({ message, setMessage }: { message: string; setMessage: (value: string) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    const cleanedEmail = email.trim().toLowerCase();

    const client = supabase;
    if (!client) {
      setBusy(false);
      return;
    }

    if (mode === "signup") {
      const response = await fetch(`/api/beta/requests?email=${encodeURIComponent(cleanedEmail)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.approved) {
        const requestResponse = await fetch("/api/beta/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanedEmail })
        });
        const requestPayload = await requestResponse.json().catch(() => ({}));
        setMessage(requestResponse.ok ? "Beta request sent. Please log in once approved via email." : requestPayload.error ?? "Could not request beta access.");
        setBusy(false);
        return;
      }
    }

    const pendingInvite = localStorage.getItem("connection-pending-invite");
    const emailRedirectTo =
      mode === "signup"
        ? appUrl(pendingInvite ? `/?invite=${encodeURIComponent(pendingInvite)}` : "/")
        : undefined;

    const { data, error } =
      mode === "signup"
        ? await client.auth.signUp({
            email: cleanedEmail,
            password,
            options: {
              emailRedirectTo
            }
          })
        : await client.auth.signInWithPassword({ email: cleanedEmail, password });

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
            <ConnectionLogo className="mb-5" />
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Share moments with the people who matter.</h1>
            <p className="mt-3 text-sm leading-6 text-ink/65 dark:text-paper/65">
              Keep photos, groups, and shared plans in one quiet place.
            </p>
            <button
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 text-xs font-semibold text-ink/70 transition hover:-translate-y-0.5 hover:text-ink dark:border-white/15 dark:text-paper/65 dark:hover:text-paper"
              onClick={() => setInstallHelpOpen(true)}
              type="button"
            >
              <Download size={14} />
              save to home screen
            </button>
          </div>
          <form className="flex flex-col gap-3" onSubmit={submit}>
            <Segmented
              value={mode}
              options={[
                ["signin", "Sign in"],
                ["signup", "Register"]
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
              {busy ? "Working..." : mode === "signup" ? "Register for beta" : "Sign in"}
            </button>
          </form>
        </div>
      </section>

      {installHelpOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-5 text-ink backdrop-blur-sm dark:bg-black/60 dark:text-paper"
          onClick={() => setInstallHelpOpen(false)}
        >
          <section
            className="w-full max-w-sm rounded-xl border border-line bg-white p-5 shadow-soft dark:border-white/15 dark:bg-[#242420]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-[#4aaad0] dark:text-[#8ed8f5]">iPhone</p>
                <h2 className="mt-2 text-2xl font-semibold leading-none">save like an app</h2>
              </div>
              <button
                aria-label="Close install instructions"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-ink/70 dark:border-white/15 dark:text-paper/70"
                onClick={() => setInstallHelpOpen(false)}
                type="button"
              >
                <X size={17} />
              </button>
            </div>

            <ol className="mt-5 space-y-3 text-sm leading-6 text-ink/70 dark:text-paper/65">
              <li className="rounded-lg border border-line p-3 dark:border-white/10">1. open Connection in Safari on your iPhone.</li>
              <li className="rounded-lg border border-line p-3 dark:border-white/10">2. tap the Safari share button.</li>
              <li className="rounded-lg border border-line p-3 dark:border-white/10">3. choose Add to Home Screen.</li>
            </ol>

            <p className="mt-4 text-xs leading-5 text-ink/45 dark:text-paper/42">
              after that, Connection opens from your home screen with a more app-like feel.
            </p>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function AuthVisual() {
  const previewNotifications = [
    {
      title: "family",
      meta: "just now",
      body: "mira added a photo.",
      detail: "breakfast before the train"
    },
    {
      title: "us",
      meta: "2 min ago",
      body: "sam added an event.",
      detail: "coffee walk · aug 12, 7:00 pm"
    },
    {
      title: "trip",
      meta: "today",
      body: "alex joined the group.",
      detail: "4 members now"
    },
    {
      title: "timezone",
      meta: "saved",
      body: "dad's noon stays dad's noon.",
      detail: "your time · 2:15 am"
    }
  ];

  return (
    <div className="hidden lg:block">
      <div className="mb-10 max-w-xl">
        <p className="text-xs font-semibold lowercase tracking-[0.22em] text-rust">connections first</p>
        <h2 className="mt-4 text-6xl font-semibold lowercase leading-[0.95] text-ink dark:text-paper">
          your people, groups, photos, and plans together.
        </h2>
      </div>

      <div className="relative max-w-xl">
        <div className="rounded-lg border border-white/70 bg-white/80 p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#242420]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs lowercase tracking-[0.18em] text-ink/45 dark:text-paper/45">preview</p>
              <h3 className="mt-1 text-xl font-semibold lowercase">what connection does</h3>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-skysoft text-ink dark:bg-[#153141] dark:text-[#8ed8f5]">
              <Bell size={18} />
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-lg border border-line bg-paper/80 p-4 dark:border-white/10 dark:bg-[#1d1d1a]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs lowercase tracking-[0.18em] text-ink/45 dark:text-paper/40">group</p>
                  <h4 className="mt-1 text-2xl font-semibold">family</h4>
                </div>
                <div className="flex -space-x-2">
                  <Avatar name="mira" size="sm" />
                  <Avatar name="sam" size="sm" />
                  <Avatar name="alex" size="sm" />
                </div>
              </div>
              <p className="mt-3 text-sm lowercase text-ink/60 dark:text-paper/55">private photos and plans stay with the people in that group.</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-paper/80 p-4 dark:border-white/10 dark:bg-[#1d1d1a]">
                <div className="mb-3 flex items-center gap-2 text-sm lowercase font-semibold text-ink/65 dark:text-paper/60">
                  <CalendarDays size={16} />
                  aug / let's make it count
                </div>
                <div className="rounded-lg bg-sage/25 p-3 dark:bg-sage/20">
                  <p className="text-sm font-semibold lowercase">call dad</p>
                  <p className="mt-1 text-xs lowercase text-ink/60 dark:text-paper/55">your time: 2:15 am</p>
                  <p className="text-xs lowercase text-ink/45 dark:text-paper/40">entered as: 12:00 pm · nepal</p>
                </div>
              </div>

              <div className="grid gap-2">
                {previewNotifications.map((item, index) => (
                  <div
                    key={`${item.title}-${item.meta}`}
                    className={clsx(
                      "rounded-lg border border-line bg-paper/80 p-3 dark:border-white/10 dark:bg-[#1d1d1a]",
                      index === 0 && "border-sage/60 bg-sage/15 dark:bg-sage/10"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold lowercase">{item.title}</p>
                      <p className="shrink-0 text-[0.6rem] lowercase tracking-[0.16em] text-ink/35 dark:text-paper/35">{item.meta}</p>
                    </div>
                    <p className="mt-2 text-xs lowercase leading-5 text-ink/65 dark:text-paper/60">{item.body}</p>
                    <p className="mt-2 rounded-md bg-white/45 px-2 py-1.5 text-xs lowercase text-ink/55 dark:bg-white/5 dark:text-paper/50">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 text-sm text-ink/60 dark:text-paper/60">
          <span className="h-px flex-1 bg-line dark:bg-white/15" />
          photos, groups, plans, and the tiny updates that matter
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
  needsPasswordSetup,
  onComplete
}: {
  userId: string;
  message: string;
  setMessage: (value: string) => void;
  needsPasswordSetup: boolean;
  onComplete: () => void;
}) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState(browserTimezone());
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setMessage("");
    if (needsPasswordSetup && password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    const cleanedUsername = normalizeUsername(username);
    const validationMessage = usernameError(cleanedUsername);
    if (validationMessage) {
      setUsername(cleanedUsername);
      setMessage(validationMessage);
      return;
    }
    if (needsPasswordSetup) {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) {
        setMessage(passwordError.message);
        return;
      }
    }
    const { error } = await supabase.from("profiles").insert({
      id: userId,
      username: cleanedUsername,
      display_name: displayName,
      preferred_timezone: timezone
    });

    if (error) {
      setMessage(profileErrorMessage(error));
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
          <Field label="Username" value={username} onChange={(value) => setUsername(normalizeUsername(value))} required />
          <Field label="Display name" value={displayName} onChange={setDisplayName} required />
          {needsPasswordSetup ? (
            <Field label="Set password" value={password} onChange={setPassword} required type="password" />
          ) : null}
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
          <p className="truncate text-sm text-ink/60 dark:text-paper/60">{profile.username}</p>
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
  const [username, setUsername] = useState(normalizeUsername(profile.username));
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [timezone, setTimezone] = useState(profile.preferred_timezone);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [busy, setBusy] = useState(false);
  const [betaRequests, setBetaRequests] = useState<BetaRequest[] | null>(null);
  const [betaUsers, setBetaUsers] = useState<BetaUser[]>([]);
  const [betaAdminOpen, setBetaAdminOpen] = useState(false);

  useEffect(() => {
    void loadBetaRequests();
  }, []);

  async function accountAuthHeaders() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : null;
  }

  async function loadBetaRequests() {
    const headers = await accountAuthHeaders();
    if (!headers) return;
    const response = await fetch("/api/beta/requests", { headers });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 403) {
      setBetaRequests(null);
      setBetaUsers([]);
      return;
    }
    if (!response.ok) return;
    setBetaRequests(payload.requests ?? []);
    setBetaUsers(payload.users ?? []);
  }

  async function approveBetaRequest(email: string) {
    const headers = await accountAuthHeaders();
    if (!headers) return;
    setBusy(true);
    const response = await fetch("/api/beta/requests", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Could not approve beta request.");
    } else {
      setBetaRequests((current) => current?.filter((request) => request.email !== email) ?? null);
      setMessage("Beta request approved. Invite email sent.");
    }
    setBusy(false);
  }

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
      setMessage(profileErrorMessage(error));
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
    const cleanedUsername = normalizeUsername(username);
    const validationMessage = usernameError(cleanedUsername);
    if (validationMessage) {
      setUsername(cleanedUsername);
      setMessage(validationMessage);
      setBusy(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        username: cleanedUsername,
        display_name: displayName,
        preferred_timezone: timezone,
        avatar_url: avatarUrl || null
      })
      .eq("id", profile.id);

    if (error) {
      setMessage(profileErrorMessage(error));
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
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/25 px-3 pt-[calc(5.75rem+env(safe-area-inset-top))] text-ink backdrop-blur-sm dark:bg-black/55 dark:text-paper"
      onClick={onClose}
    >
      <section
        className="w-full max-w-lg rounded-2xl border border-line bg-white p-4 text-left shadow-soft dark:border-white/15 dark:bg-[#242420]"
        onClick={(event) => event.stopPropagation()}
      >
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
        <Field label="Username" value={username} onChange={(value) => setUsername(normalizeUsername(value))} required />
        <Field label="Display name" value={displayName} onChange={setDisplayName} required />
        <SelectField label="Timezone" value={timezone} onChange={setTimezone} />
        <button
          className="rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper dark:bg-paper dark:text-ink"
          disabled={busy}
        >
          Save account
        </button>
      </form>

      {betaRequests !== null ? (
        <button
          className="mt-4 flex w-full items-center justify-between rounded-full border border-line px-4 py-2.5 text-sm font-medium dark:border-white/15"
          onClick={() => setBetaAdminOpen(true)}
          type="button"
        >
          <span>Beta admin</span>
          <span className="text-xs text-ink/50 dark:text-paper/50">
            {betaRequests.length} waiting · {betaUsers.length} users
          </span>
        </button>
      ) : null}

      <button
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-medium dark:border-white/15"
        onClick={() => supabase?.auth.signOut()}
        type="button"
      >
        <LogOut size={15} />
        Sign out
      </button>
      {betaAdminOpen && betaRequests !== null ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/25 px-3 pt-[calc(5.75rem+env(safe-area-inset-top))] backdrop-blur-sm dark:bg-black/55"
          onClick={() => setBetaAdminOpen(false)}
        >
          <section
            className="max-h-[calc(100vh-8rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-white p-4 shadow-soft dark:border-white/15 dark:bg-[#242420]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4aaad0] dark:text-[#8ed8f5]">Beta admin</p>
                <h2 className="mt-1 text-2xl font-semibold">Access</h2>
                <p className="mt-1 text-xs text-ink/55 dark:text-paper/55">
                  approve waiting emails and see who already joined
                </p>
              </div>
              <button
                className="grid h-9 w-9 place-items-center rounded-full border border-line dark:border-white/15"
                onClick={() => setBetaAdminOpen(false)}
                type="button"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line p-3 dark:border-white/15">
              <div>
                <p className="text-sm font-semibold">{betaRequests.length} waiting</p>
                <p className="text-xs text-ink/50 dark:text-paper/50">{betaUsers.length} users in platform</p>
              </div>
              <button
                className="rounded-full border border-line px-3 py-1.5 text-xs font-medium dark:border-white/15"
                onClick={() => void loadBetaRequests()}
                type="button"
              >
                Refresh
              </button>
            </div>

            <div className="space-y-5">
              <section>
                <h3 className="mb-2 text-sm font-semibold">Waiting approval</h3>
                {betaRequests.length ? (
                  <div className="grid gap-2">
                    {betaRequests.map((request) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 dark:border-white/10"
                        key={request.email}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{request.email}</p>
                          <p className="text-xs text-ink/45 dark:text-paper/45">{notificationTime(request.requestedAt)}</p>
                        </div>
                        <button
                          className="rounded-full bg-skysoft px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-50"
                          disabled={busy}
                          onClick={() => void approveBetaRequest(request.email)}
                          type="button"
                        >
                          Approve
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-line px-3 py-3 text-sm text-ink/55 dark:border-white/10 dark:text-paper/55">
                    no pending beta requests
                  </p>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Already in platform</h3>
                {betaUsers.length ? (
                  <div className="grid gap-2">
                    {betaUsers.map((user) => (
                      <div className="rounded-lg border border-line px-3 py-2 dark:border-white/10" key={user.id}>
                        <p className="truncate text-sm font-semibold">{user.email}</p>
                        <p className="text-xs text-ink/45 dark:text-paper/45">
                          joined {notificationTime(user.createdAt)}
                          {user.lastSignInAt ? ` · active ${notificationTime(user.lastSignInAt)}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-line px-3 py-3 text-sm text-ink/55 dark:border-white/10 dark:text-paper/55">
                    no users yet
                  </p>
                )}
              </section>
            </div>
          </section>
        </div>
      ) : null}
      </section>
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
  const editingFormRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!editingGroupId) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && editingFormRef.current?.contains(target)) return;
      setEditingGroupId(null);
      setEditingName("");
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [editingGroupId]);

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

    const { error } = await supabase.rpc("delete_group", {
      target_group_id: group.id
    });

    if (error) {
      setMessage(`Failed to delete group. ${error.message}`);
      return;
    }

    if (activeGroupId === group.id) setActiveGroupId(null);
    await reload();
    setMessage("Group deleted successfully.");
  }

  async function leaveGroup(group: Group) {
    if (!supabase) return;
    if (group.role === "owner") {
      setMessage("Admins cannot leave their own group. Delete the group instead.");
      return;
    }

    const confirmed = window.confirm(`Leave ${group.name}? You will no longer see its photos or calendar.`);
    if (!confirmed) return;
    setMessage("");

    const { error } = await supabase.rpc("leave_group", {
      target_group_id: group.id
    });

    if (error) {
      setMessage(`Failed to leave group. ${error.message}`);
      return;
    }

    if (activeGroupId === group.id) setActiveGroupId(null);
    setActionGroupId(null);
    setInviteGroupId(null);
    await reload();
    setMessage("Left group.");
  }

  return (
    <section>
      <div className="mb-5 flex items-center justify-end">
        <button
          className="rounded-full border border-line bg-white/80 px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-paper dark:border-white/15 dark:bg-[#242420] dark:text-paper"
          onClick={() => {
            setInviteGroupId(null);
            setActionGroupId(null);
            setEditingGroupId(null);
            setAddOpen(true);
          }}
          type="button"
        >
          New Group
        </button>
      </div>

      {addOpen ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/45 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-ink sm:items-center">
          <form className="mx-auto w-full max-w-lg rounded-t-2xl border border-white/70 bg-white p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#242420] dark:text-paper sm:rounded-2xl" onSubmit={createGroup}>
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
                className="rounded-full border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-moss dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
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
            <article key={group.id} className="rounded-lg border border-white/70 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-white/15 dark:bg-[#242420]">
              {isEditing ? (
                <form ref={editingFormRef} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[4rem_minmax(0,1fr)_5rem]" onSubmit={(event) => void renameGroup(event, group)}>
                  <GroupThumb groupId={group.id} photos={photos} className="h-12 w-12" />
                  <input
                    className="min-w-0 rounded-full border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-moss dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    autoFocus
                  />
                  <div className="col-span-2 flex justify-end gap-2 sm:col-span-1">
                    <button aria-label="Save group name" className="grid h-8 w-8 place-items-center rounded-full bg-ink text-paper dark:bg-paper dark:text-ink">
                      <Check size={15} />
                    </button>
                    <button
                      aria-label="Cancel rename"
                      className="grid h-8 w-8 place-items-center rounded-full border border-line dark:border-white/15"
                      onClick={() => setEditingGroupId(null)}
                      type="button"
                    >
                      <X size={15} />
                    </button>
                  </div>
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
                    className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white/75 text-ink/65 transition hover:bg-paper dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper/65"
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
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 sm:grid-cols-4 dark:border-white/15">
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
                  <button
                    className="flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm dark:border-white/15"
                    onClick={() => void leaveGroup(group)}
                    type="button"
                  >
                    <LogOut size={15} />
                    Leave
                  </button>
                </div>
              ) : null}
              {inviteGroupId === group.id ? (
                <div className="mt-3">
                  <MemberPanel
                    group={group}
                    notifyGroupMembers={notifyGroupMembers}
                    onDone={() => setInviteGroupId(null)}
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

function GroupThumb({ groupId, photos, className }: { groupId: string; photos: PhotoItem[]; className?: string }) {
  const image = photos.find((photo) => photo.groupId === groupId)?.src;

  return (
    <span className={clsx("block h-16 w-16 overflow-hidden rounded-full bg-paper dark:bg-[#1d1d1a]", className)}>
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
        className="w-full rounded-full border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-moss dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
        placeholder={placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {results.length ? (
        <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-10 overflow-hidden rounded-lg border border-line bg-white shadow-soft dark:border-white/15 dark:bg-[#1d1d1a]">
          {results.map((result) => (
            <button
              key={result.id}
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-paper dark:hover:bg-[#242420]"
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
  members,
  notifyGroupMembers,
  onOpenGroupCalendar,
  onOpenGroupProjects,
  onOpenProfile,
  openPhoto,
  photos,
  profile,
  reload,
  setMessage,
  setActiveGroupId
}: {
  group: Group;
  members: GroupMember[];
  notifyGroupMembers: (groupId: string, message: string, metadata?: Record<string, unknown>) => Promise<void>;
  onOpenGroupCalendar: (groupId: string) => void;
  onOpenGroupProjects: (groupId: string) => void;
  onOpenProfile: (profileId: string, displayName?: string) => void;
  openPhoto: OpenPhoto;
  photos: PhotoItem[];
  profile: Profile;
  reload: WorkspaceReload;
  setMessage: (value: string) => void;
  setActiveGroupId: (id: string | null) => void;
}) {
  const owners = [...new Set(photos.map((photo) => photo.ownerId))];
  const [membersOpen, setMembersOpen] = useState(false);
  const groupSwipeStartRef = useRef<{ x: number; y: number } | null>(null);

  function finishGroupSwipe(x: number, y: number) {
    const start = groupSwipeStartRef.current;
    groupSwipeStartRef.current = null;
    if (!start || membersOpen) return;

    const deltaX = x - start.x;
    const deltaY = y - start.y;
    if (deltaX > 72 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      setActiveGroupId(null);
    }
  }

  return (
    <section
      className="flex flex-col gap-7"
      onTouchStart={(event) => {
        const touch = event.touches[0];
        if (!touch) return;
        groupSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        const touch = event.changedTouches[0];
        if (!touch) return;
        finishGroupSwipe(touch.clientX, touch.clientY);
      }}
      onTouchCancel={() => {
        groupSwipeStartRef.current = null;
      }}
    >
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_5.5rem] items-start">
        <button aria-label="Back to groups" className="grid h-10 w-10 place-items-center" onClick={() => setActiveGroupId(null)}>
          <ArrowLeft size={23} />
        </button>
        <div className="text-center">
          <h1 className="text-lg font-semibold">{group.name}</h1>
          <button
            className="text-xs text-ink/55 transition hover:text-ink dark:text-paper/55 dark:hover:text-paper"
            onClick={() => setMembersOpen(true)}
            type="button"
          >
            {group.member_count} {group.member_count === 1 ? "member" : "members"}
          </button>
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
            aria-label={`${group.name} projects`}
            className="grid h-10 w-10 place-items-center"
            onClick={() => onOpenGroupProjects(group.id)}
            type="button"
          >
            <FolderOpen size={20} />
          </button>
          <button
            aria-label={`${group.name} members`}
            className="grid h-10 w-10 place-items-center"
            onClick={() => setMembersOpen(true)}
            type="button"
          >
            <Users size={20} />
          </button>
        </div>
      </div>

      {membersOpen ? (
        <GroupMembersSheet
          group={group}
          members={members}
          notifyGroupMembers={notifyGroupMembers}
          onClose={() => setMembersOpen(false)}
          onOpenProfile={(member) => {
            setMembersOpen(false);
            onOpenProfile(member.id, member.displayName);
          }}
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

function GroupMembersSheet({
  group,
  members,
  notifyGroupMembers,
  onClose,
  onOpenProfile,
  profile,
  reload,
  setMessage
}: {
  group: Group;
  members: GroupMember[];
  notifyGroupMembers: (groupId: string, message: string, metadata?: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
  onOpenProfile: (member: GroupMember) => void;
  profile: Profile;
  reload: WorkspaceReload;
  setMessage: (value: string) => void;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div
      className="fixed inset-0 z-40 flex items-start bg-black/30 px-3 pt-[calc(5.75rem+env(safe-area-inset-top))] text-ink backdrop-blur-sm dark:bg-black/55"
      onClick={onClose}
    >
      <section
        className="mx-auto w-full max-w-lg rounded-2xl border border-white/70 bg-white p-4 shadow-soft dark:border-white/15 dark:bg-[#242420] dark:text-paper"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{group.name}</h2>
            <p className="text-xs text-ink/55 dark:text-paper/55">
              {members.length || group.member_count} {(members.length || group.member_count) === 1 ? "member" : "members"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label={`Invite to ${group.name}`}
              className="grid h-9 w-9 place-items-center rounded-full border border-line dark:border-white/15"
              onClick={() => setInviteOpen((value) => !value)}
              type="button"
            >
              <Plus size={18} />
            </button>
            <button
              aria-label="Close members"
              className="grid h-9 w-9 place-items-center rounded-full border border-line dark:border-white/15"
              onClick={onClose}
              type="button"
            >
              <X size={17} />
            </button>
          </div>
        </div>
        {inviteOpen ? (
          <MemberPanel
            existingMemberIds={members.map((member) => member.id)}
            group={group}
            notifyGroupMembers={notifyGroupMembers}
            onDone={() => setInviteOpen(false)}
            profile={profile}
            reload={reload}
            setMessage={setMessage}
          />
        ) : null}
        {members.length ? (
          <div className={`${inviteOpen ? "mt-4" : ""} grid max-h-[55vh] gap-2 overflow-y-auto overscroll-contain`}>
            {members.map((member) => (
              <button
                key={member.id}
                className="flex items-center gap-3 rounded-lg px-1 py-2 text-left transition hover:bg-paper dark:hover:bg-white/5"
                onClick={() => onOpenProfile(member)}
                type="button"
              >
                <Avatar name={member.displayName} src={member.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{member.username}</p>
                  <p className="truncate text-sm text-ink/55 dark:text-paper/55">{member.displayName}</p>
                </div>
                <span className="rounded-full border border-line px-2.5 py-1 text-xs text-ink/60 dark:border-white/15 dark:text-paper/60">
                  {groupRoleLabel(member.role)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-ink/55 dark:text-paper/55">Members will appear here after refresh.</p>
        )}
      </section>
    </div>
  );
}

function MemberPanel({
  existingMemberIds = [],
  group,
  notifyGroupMembers,
  onDone,
  profile,
  reload,
  setMessage
}: {
  existingMemberIds?: string[];
  group: Group;
  notifyGroupMembers: (groupId: string, message: string, metadata?: Record<string, unknown>) => Promise<void>;
  onDone?: () => void;
  profile: Profile;
  reload: WorkspaceReload;
  setMessage: (value: string) => void;
}) {
  const [invitees, setInvitees] = useState<ConnectionProfile[]>([]);
  const [busyLink, setBusyLink] = useState(false);
  const excludedInviteIds = [profile.id, ...existingMemberIds, ...invitees.map((invitee) => invitee.id)];

  async function inviteMember(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !invitees.length) return;
    setMessage("");

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Authentication required.");
      return;
    }

    const invites = invitees.map((invitee) => ({
      group_id: group.id,
      token: crypto.randomUUID().replaceAll("-", ""),
      role: "editor",
      created_by: user.id,
      invitee_id: invitee.id
    }));

    const { error } = await supabase.from("group_invites").insert(invites);

    if (error) {
      setMessage(`Failed to send invite. ${error.message}`);
      return;
    }

    const usernames = invitees.map((invitee) => invitee.username).join(", ");
    await notifyGroupMembers(group.id, `${profile.display_name} invited ${usernames} to ${group.name}.`);
    setMessage(invitees.length === 1 ? `Invite sent to ${invitees[0].username}.` : `Invites sent to ${invitees.length} people.`);
    setInvitees([]);
    await reload();
    onDone?.();
  }

  async function copyInviteLink() {
    if (!supabase) return;
    setBusyLink(true);
    setMessage("");

    const inviteUrl = appUrl(`/?invite=${group.invite_token}`);
    const copied = await copyText(inviteUrl);
    setMessage(copied ? "Invite link copied." : "Could not copy invite link. Try again.");
    if (copied) onDone?.();
    setBusyLink(false);
  }

  return (
    <section className="rounded-lg border border-white/70 bg-white/85 p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#242420]">
      <div className="mb-3 flex items-center gap-2">
        <Shield size={18} />
        <h2 className="font-semibold">Invite</h2>
      </div>
      <form className="flex gap-2" onSubmit={inviteMember}>
        <div className="min-w-0 flex-1">
          <UsernameSearchPicker
            excludeIds={excludedInviteIds}
            onSelect={(invitee) => setInvitees((current) => [...current, invitee])}
            placeholder="Search"
            setMessage={setMessage}
          />
        </div>
        <button
          aria-label="Invite member"
          disabled={group.role !== "owner" || !invitees.length}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rust text-ink disabled:opacity-40"
        >
          <Send size={16} />
        </button>
        <button
          aria-label="Copy invite link"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-ink disabled:opacity-40 dark:border-white/15 dark:text-paper"
          disabled={group.role !== "owner" || busyLink}
          onClick={() => void copyInviteLink()}
          type="button"
        >
          <Copy size={16} />
        </button>
      </form>
      {invitees.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {invitees.map((invitee) => (
            <button
              key={invitee.id}
              className="rounded-full border border-line px-3 py-1 text-sm dark:border-white/15"
              onClick={() => setInvitees((current) => current.filter((item) => item.id !== invitee.id))}
              type="button"
            >
              {invitee.username} <X className="inline" size={13} />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CalendarSurface({
  canCreateEvent,
  view,
  timezone,
  events,
  onCreateEvent,
  selectedDate,
  setSelectedDate
}: {
  canCreateEvent: boolean;
  view: ViewMode;
  timezone: string;
  events: EventItem[];
  onCreateEvent: (date: string) => void;
  selectedDate: string;
  setSelectedDate: (value: string) => void;
}) {
  const lastTapRef = useRef<{ date: string; time: number } | null>(null);
  const today = DateTime.now().setZone(timezone);
  const selected = DateTime.fromISO(selectedDate, { zone: timezone });
  const todayStart = today.startOf("day");
  const eventDays = [
    ...new Map(
      events
        .map((event) => localDateTime(event, timezone).startOf("day"))
        .sort((first, second) => first.toMillis() - second.toMillis())
        .map((day) => [day.toISODate(), day])
    ).values()
  ];
  const selectedDay = selected.startOf("day");
  const upcomingEventDays = eventDays.filter((day) => day.toMillis() >= todayStart.toMillis());
  const agendaBaseDays =
    selectedDay.toMillis() >= todayStart.toMillis()
      ? upcomingEventDays
      : upcomingEventDays.filter((day) => day.hasSame(todayStart, "day"));
  const agendaDays = agendaBaseDays.some((day) => day.toISODate() === selectedDay.toISODate())
    ? agendaBaseDays
    : [selectedDay.toMillis() >= todayStart.toMillis() ? selectedDay : todayStart, ...agendaBaseDays].sort(
        (first, second) => first.toMillis() - second.toMillis()
      );
  const monthGridStart = selected.startOf("month").startOf("week");
  const monthGridEnd = selected.endOf("month").endOf("week");
  const monthGridDayCount = Math.round(monthGridEnd.diff(monthGridStart, "days").days) + 1;
  const days =
    view === "week"
      ? Array.from({ length: 7 }, (_, index) => selected.startOf("week").plus({ days: index }))
      : view === "month"
        ? Array.from({ length: monthGridDayCount }, (_, index) => monthGridStart.plus({ days: index }))
        : agendaDays.length
          ? agendaDays
          : [today];
  function moveMonth(direction: -1 | 1) {
    const nextMonth = selected.plus({ months: direction }).startOf("month");
    setSelectedDate(nextMonth.toISODate() ?? selectedDate);
  }

  return (
    <section className="rounded-lg border border-white/70 bg-white/85 p-3 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#242420]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-ink/65 dark:text-paper/65">
          <CalendarDays size={16} />
          {view === "month" ? (
            <div className="flex items-center gap-1">
              <button
                aria-label="Previous month"
                className="grid h-7 w-7 place-items-center rounded-full border border-line bg-paper text-ink dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
                onClick={() => moveMonth(-1)}
                type="button"
              >
                <span aria-hidden="true">{"<"}</span>
              </button>
              <button
                className="rounded-full px-2 py-1 font-medium text-ink transition hover:bg-ink/5 dark:text-paper dark:hover:bg-paper/10"
                onClick={() => moveMonth(1)}
                type="button"
              >
                {selected.toFormat("LLL")}
              </button>
              <button
                aria-label="Next month"
                className="grid h-7 w-7 place-items-center rounded-full border border-line bg-paper text-ink dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
                onClick={() => moveMonth(1)}
                type="button"
              >
                <span aria-hidden="true">{">"}</span>
              </button>
            </div>
          ) : (
            <span>{selected.toFormat("LLL")}</span>
          )}
          <span className="text-ink/35 dark:text-paper/35">/</span>
          <span>let&apos;s make it count</span>
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
          "grid gap-2 pb-1",
          view === "agenda" && "grid-flow-col auto-cols-[4.75rem] overflow-x-auto",
          view === "week" && "grid-cols-4 sm:grid-cols-7",
          view === "month" && "grid-cols-7 gap-1"
        )}
      >
        {days.map((day) => {
          const dayEvents = events.filter((event) => localDateTime(event, timezone).toISODate() === day.toISODate());
          const dayIso = day.toISODate() ?? selectedDate;
          const isSelected = dayIso === selectedDate;
          const isOutsideMonth = view === "month" && !day.hasSame(selected, "month");
          function handleDateClick() {
            setSelectedDate(dayIso);
            const now = Date.now();
            const lastTap = lastTapRef.current;
            if (canCreateEvent && lastTap?.date === dayIso && now - lastTap.time < 360) {
              lastTapRef.current = null;
              onCreateEvent(dayIso);
              return;
            }
            lastTapRef.current = { date: dayIso, time: now };
          }

          return (
            <button
              key={dayIso}
              className={clsx(
                "rounded-lg border text-left transition hover:-translate-y-0.5",
                view === "agenda" && "aspect-square min-h-[4.75rem] p-2",
                view === "week" && "min-h-[4.25rem] p-2",
                view === "month" && "min-h-14 p-1.5",
                isSelected
                  ? "border-ink bg-ink text-paper shadow-sm dark:border-paper dark:bg-paper dark:text-ink"
                  : "border-line bg-paper/80 text-ink hover:border-moss dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper",
                isOutsideMonth && "opacity-35"
              )}
              onClick={handleDateClick}
              onDoubleClick={() => {
                if (!canCreateEvent) return;
                setSelectedDate(dayIso);
                onCreateEvent(dayIso);
              }}
            >
              <span className={clsx("block opacity-65", view === "month" ? "text-[0.65rem]" : "text-xs")}>
                {day.toFormat("ccc")}
              </span>
              <span className={clsx("font-semibold", view === "month" ? "text-base" : "text-lg")}>{day.day}</span>
              {dayEvents.length ? (
                <span className={clsx("flex gap-1", view === "month" ? "mt-0.5" : "mt-1")}>
                  {dayEvents.slice(0, 3).map((event) => (
                    <span key={event.id} className={clsx("rounded-full bg-current", view === "month" ? "h-1 w-1" : "h-1.5 w-1.5")} />
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
  fitnessProjectIds,
  loggedWorkoutEventIds,
  onDelete,
  onEdit,
  onResetWorkout,
  timezone,
  viewerWeatherByEventId
}: {
  editableGroups: string[];
  emptyBody: string;
  events: EventItem[];
  fitnessProjectIds: Set<string>;
  loggedWorkoutEventIds: Set<string>;
  onDelete: (event: EventItem) => void;
  onEdit: (event: EventItem) => void;
  onResetWorkout: (event: EventItem) => void;
  timezone: string;
  viewerWeatherByEventId: Record<string, EventWeather>;
}) {
  const [actionEventId, setActionEventId] = useState<string | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  if (!events.length) {
    return <EmptyPanel title="No events" body={emptyBody} />;
  }

  function activateWorkout(event: EventItem) {
    setLaunchingId(event.id);
    window.setTimeout(() => {
      onEdit(event);
      setLaunchingId(null);
    }, 260);
  }

  function handleFitnessTap(event: EventItem) {
    if (loggedWorkoutEventIds.has(event.id)) {
      onResetWorkout(event);
      return;
    }
    activateWorkout(event);
  }

  return (
    <section className="flex flex-col gap-3">
      {events.map((event) => {
        const local = localDateTime(event, timezone);
        const original = sourceDateTime(event);
        const canEdit = event.group_id ? editableGroups.includes(event.group_id) : true;
        const isFitnessEvent = Boolean(event.project_id && fitnessProjectIds.has(event.project_id));
        const isCompleted = isFitnessEvent && loggedWorkoutEventIds.has(event.id);
        const weatherEmoji = eventHasWeatherPlace(event)
          ? event.weather_emoji ?? ""
          : viewerWeatherByEventId[event.id]?.emoji ?? "";

        return (
          <article
            key={event.id}
            className="rounded-lg border border-white/70 bg-white/85 p-4 shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#242420]"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <button
                className="min-w-0 text-left"
                onClick={() => {
                  if (isFitnessEvent) {
                    handleFitnessTap(event);
                    return;
                  }
                  if (canEdit) onEdit(event);
                  else setActionEventId(event.id);
                }}
                type="button"
              >
                <h3 className="line-clamp-2 flex items-center gap-1.5 break-words text-lg font-semibold leading-snug">
                  {isFitnessEvent ? (
                    <Dumbbell className={clsx("shrink-0", isCompleted ? "text-emerald-500" : "text-clay")} size={16} />
                  ) : null}
                  <span className="min-w-0">{event.title}</span>
                </h3>
                {event.location ? <p className="text-sm text-ink/60 dark:text-paper/60">{event.location}</p> : null}
              </button>
              <div className="flex shrink-0 items-start gap-2">
                {isFitnessEvent ? (
                  <button
                    aria-label={isCompleted ? `${event.title} already logged` : `Log ${event.title}`}
                    className={clsx(
                      "grid h-9 w-9 place-items-center rounded-full border",
                      isCompleted ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-500" : "border-clay/40 bg-clay/10 text-clay",
                      launchingId === event.id && "session-launch-pulse"
                    )}
                    onClick={() => handleFitnessTap(event)}
                    type="button"
                  >
                    {isCompleted ? <CheckCircle2 size={17} /> : <Dumbbell size={17} />}
                  </button>
                ) : null}
                <div className="rounded-lg bg-moss px-3 py-2 text-right text-sm font-medium text-white">
                  <div>{local.toFormat("h:mm a")}</div>
                  <div className="text-xs opacity-80">{local.toFormat("LLL d")}</div>
                </div>
                <button
                  aria-label={`${event.title} options`}
                  className="grid h-9 w-9 place-items-center rounded-full border border-line bg-paper dark:border-white/15 dark:bg-[#1d1d1a]"
                  onClick={() => setActionEventId((current) => (current === event.id ? null : event.id))}
                  type="button"
                >
                  <MoreHorizontal size={17} />
                </button>
              </div>
            </div>
            {actionEventId === event.id ? (
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 dark:border-white/15 sm:grid-cols-4">
                <button
                  className="flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm dark:border-white/15"
                  onClick={() => downloadEventIcs(event)}
                  type="button"
                >
                  <Download size={15} />
                  Apple
                </button>
                <button
                  className="flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm dark:border-white/15"
                  onClick={() => openGoogleCalendar(event)}
                  type="button"
                >
                  <CalendarDays size={15} />
                  Google
                </button>
                <button
                  className="flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-40 dark:border-white/15"
                  disabled={!canEdit}
                  onClick={() => onEdit(event)}
                  type="button"
                >
                  <Pencil size={15} />
                  Edit
                </button>
                <button
                  className="flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-40 dark:border-white/15"
                  disabled={!canEdit}
                  onClick={() => onDelete(event)}
                  type="button"
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            ) : null}
            {event.description ? (
              <p className="mt-3 text-sm leading-6 text-ink/70 dark:text-paper/70">{event.description}</p>
            ) : null}
            {event.reference ? (
              <a
                className="mt-3 inline-flex max-w-full items-center gap-2 truncate rounded-full border border-line px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:text-ink dark:border-white/15 dark:text-paper/70 dark:hover:text-paper"
                href={referenceHref(event.reference)}
                rel="noreferrer"
                target="_blank"
              >
                <Link2 className="shrink-0" size={15} />
                <span className="truncate">{event.reference}</span>
              </a>
            ) : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <TimeChip label="Your time" time={local.toFormat("ccc, LLL d, h:mm a")} zone={timezone} emoji={weatherEmoji} />
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
  group: Group | null;
  groups: Group[];
  notifyGroupMembers: (groupId: string, message: string, metadata?: Record<string, unknown>) => Promise<void>;
  onCancelEdit: () => void;
  onGroupChange: (calendarId: string) => void;
  onSaved: (calendarId: string, selectedDate: string) => void;
  profile: Profile;
  selectedDate: string;
  reload: WorkspaceReload;
  setMessage: (value: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [reference, setReference] = useState("");
  const [locationLatitude, setLocationLatitude] = useState<number | null>(null);
  const [locationLongitude, setLocationLongitude] = useState<number | null>(null);
  const [locationPlaceId, setLocationPlaceId] = useState<string | null>(null);
  const [date, setDate] = useState(selectedDate);
  const [time, setTime] = useState("12:00");
  const [timezone, setTimezone] = useState(profile.preferred_timezone);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!editingEvent) setDate(selectedDate);
  }, [editingEvent, selectedDate]);
  useEffect(() => {
    if (!editingEvent) return;
    const original = sourceDateTime(editingEvent);
    setTitle(editingEvent.title);
    setDescription(editingEvent.description ?? "");
    setLocation(editingEvent.location ?? "");
    setReference(editingEvent.reference ?? "");
    setLocationLatitude(editingEvent.location_lat ?? null);
    setLocationLongitude(editingEvent.location_lon ?? null);
    setLocationPlaceId(editingEvent.location_place_id ?? null);
    setDate(original.toISODate() ?? selectedDate);
    setTime(original.toFormat("HH:mm"));
    setTimezone(editingEvent.source_timezone);
  }, [editingEvent, selectedDate]);

  async function saveEvent(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current || !supabase || !title.trim()) return;
    savingRef.current = true;
    setSaving(true);
    setMessage("");

    try {
      const instant = DateTime.fromISO(`${date}T${time}`, { zone: timezone });
      if (!instant.isValid) {
        setMessage("That date, time, and timezone combination is not valid.");
        return;
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        reference: reference.trim() || null,
        location_lat: locationLatitude,
        location_lon: locationLongitude,
        location_place_id: locationPlaceId,
        starts_at_utc: instant.toUTC().toISO(),
        source_timezone: timezone
      };
      const targetGroupId = group?.id ?? null;

      const { data: savedEvent, error } = editingEvent
        ? await supabase
            .from("events")
            .update({ ...payload, group_id: targetGroupId })
            .eq("id", editingEvent.id)
            .select("*")
            .single()
        : await supabase
            .from("events")
            .insert({
              ...payload,
              group_id: targetGroupId,
              creator_id: profile.id,
              owner_id: profile.id
            })
            .select("*")
            .single();

      if (error) {
        setMessage(`Failed to save calendar event. ${error.message}`);
        return;
      }

      const eventWeather = savedEvent && (payload.location || (payload.location_lat !== null && payload.location_lon !== null))
        ? await fetchEventWeather({
            fallbackTimezone: profile.preferred_timezone,
            latitude: payload.location_lat,
            location: payload.location,
            longitude: payload.location_lon,
            startsAtUtc: payload.starts_at_utc
          })
        : null;
      if (savedEvent && eventWeather) {
        await supabase.from("events").update(weatherColumns(eventWeather)).eq("id", savedEvent.id);
      }

      const action = editingEvent ? "updated" : "added";
      const changeSummary = eventChangeSummary(editingEvent, payload);
      const savedLocalDate = DateTime.fromISO(payload.starts_at_utc ?? "", { zone: "utc" })
        .setZone(profile.preferred_timezone)
        .toISODate();
      if (group) {
        await notifyGroupMembers(
          group.id,
          `${profile.display_name} ${action} an event in ${group.name}.`,
          {
            type: "calendar_event",
            action,
            eventId: savedEvent?.id ?? editingEvent?.id,
            eventTitle: payload.title,
            eventDate: savedLocalDate ?? date,
            startsAtUtc: payload.starts_at_utc,
            groupId: group.id,
            summary: editingEvent ? `${payload.title}: ${changeSummary}` : undefined
          }
        );
      }
      onSaved(group?.id ?? "personal", savedLocalDate ?? date);
      setTitle("");
      setDescription("");
      setLocation("");
      setReference("");
      setLocationLatitude(null);
      setLocationLongitude(null);
      setLocationPlaceId(null);
      onCancelEdit();
      await reload();
      setMessage(`Calendar event ${action} successfully.`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const canEdit = !group || group.role === "owner" || group.role === "editor";
  const formDisabled = !canEdit || saving;

  return (
    <section
      className="max-h-[calc(100dvh-7rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/70 bg-white p-4 text-ink shadow-soft backdrop-blur dark:border-white/15 dark:bg-[#242420] dark:text-paper"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {editingEvent ? <Pencil size={18} /> : <Plus size={18} />}
          <h2 className="font-semibold">{editingEvent ? "Edit event" : "Add event"}</h2>
        </div>
        <button
          aria-label="Close event details"
          className="grid h-9 w-9 place-items-center rounded-full border border-line disabled:opacity-40 dark:border-white/15"
          disabled={saving}
          onClick={onCancelEdit}
          type="button"
        >
          <X size={17} />
        </button>
      </div>
      <form className="flex flex-col gap-3" onSubmit={saveEvent}>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Calendar
          <select
            className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-moss disabled:opacity-50 dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
            value={group?.id ?? "personal"}
            onChange={(event) => onGroupChange(event.target.value)}
            disabled={formDisabled}
          >
            <option value="personal">Personal</option>
            {groups.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <Field label="Title" value={title} onChange={setTitle} required disabled={formDisabled} />
        <LocationField
          disabled={formDisabled}
          selectedPlaceId={locationPlaceId}
          value={location}
          onChange={(value) => {
            setLocation(value);
            setLocationLatitude(null);
            setLocationLongitude(null);
            setLocationPlaceId(null);
          }}
          onSelect={(suggestion) => {
            setLocation(suggestion.displayName);
            setLocationLatitude(suggestion.latitude);
            setLocationLongitude(suggestion.longitude);
            setLocationPlaceId(suggestion.id);
          }}
        />
        <Field label="Reference" value={reference} onChange={setReference} disabled={formDisabled} placeholder="Meeting or reference link" />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Description
          <textarea
            className="min-h-20 rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal text-ink outline-none focus:border-moss dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={formDisabled}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" type="date" value={date} onChange={setDate} required disabled={formDisabled} />
          <Field label="Time" type="time" value={time} onChange={setTime} required disabled={formDisabled} />
        </div>
        <SelectField label="Timezone entered" value={timezone} onChange={setTimezone} disabled={formDisabled} />
        <button
          disabled={formDisabled}
          className="rounded-full bg-ink px-4 py-3 font-medium text-paper shadow-sm disabled:opacity-45 dark:bg-paper dark:text-ink"
        >
          {saving ? (editingEvent ? "Updating..." : "Saving...") : canEdit ? (editingEvent ? "Update event" : "Save event") : "Member access required"}
        </button>
        {editingEvent ? (
          <button
            className="rounded-full border border-line px-4 py-3 font-medium text-ink disabled:opacity-40 dark:border-white/15 dark:text-paper"
            disabled={saving}
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
  disabled,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
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
        placeholder={placeholder}
      />
    </label>
  );
}

function LocationField({
  disabled,
  onChange,
  onSelect,
  selectedPlaceId,
  value
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  onSelect: (location: LocationSuggestion) => void;
  selectedPlaceId: string | null;
  value: string;
}) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (disabled || value.trim().length < 3 || selectedPlaceId) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/locations?q=${encodeURIComponent(value.trim())}`);
        const payload = (await response.json()) as { locations?: LocationSuggestion[] };
        setSuggestions(payload.locations ?? []);
        setOpen(Boolean(payload.locations?.length));
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [disabled, selectedPlaceId, value]);

  return (
    <label className="relative flex flex-col gap-1 text-sm font-medium">
      Location
      <input
        className="rounded-full border border-line bg-white px-3 py-2 text-sm font-normal text-ink outline-none transition focus:border-moss disabled:opacity-50 dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        disabled={disabled}
        placeholder="Search a place"
      />
      {loading ? (
        <p className="px-1 text-xs font-normal text-ink/45 dark:text-paper/45">Searching places...</p>
      ) : null}
      {open && suggestions.length ? (
        <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-line bg-white text-ink shadow-soft dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              className="block w-full border-b border-line px-3 py-2 text-left last:border-b-0 hover:bg-paper dark:border-white/10 dark:hover:bg-white/5"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(suggestion);
                setOpen(false);
              }}
              type="button"
            >
              <span className="block text-sm font-medium">{suggestion.displayName.split(",")[0]}</span>
              <span className="line-clamp-1 text-xs font-normal text-ink/55 dark:text-paper/55">
                {suggestion.displayName}
              </span>
            </button>
          ))}
        </div>
      ) : null}
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
        className="rounded-full border border-line bg-white px-3 py-2 text-sm font-normal text-ink outline-none transition focus:border-moss disabled:opacity-50 dark:border-white/15 dark:bg-[#1d1d1a] dark:text-paper"
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
    <div
      className="grid rounded-full border border-line bg-paper p-1 dark:border-white/15 dark:bg-[#1d1d1a]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
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

function TimeChip({ emoji = "", label, time, zone }: { emoji?: string; label: string; time: string; zone: string }) {
  return (
    <div className="rounded-lg border border-line/70 bg-paper px-3 py-2 text-sm dark:border-white/10 dark:bg-[#1d1d1a]">
      <p className="text-xs uppercase tracking-[0.14em] text-ink/45 dark:text-paper/45">{label}</p>
      <p className="mt-1 font-medium">
        {time}
        {emoji ? <span className="ml-2" aria-hidden="true">{emoji}</span> : null}
      </p>
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
              className="aspect-square bg-[radial-gradient(circle_at_35%_35%,#f8f7f4_0,#c7c3ba_32%,#2b2b29_100%)] dark:bg-[#1d1d1a]"
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
