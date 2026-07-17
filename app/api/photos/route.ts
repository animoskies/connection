import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase-route";

const PHOTO_BUCKET = "connection-photos";

type PhotoRow = {
  id: string;
  owner_id: string;
  group_id: string | null;
  share_scope: "private" | "connections" | "group";
  title: string;
  caption: string | null;
  location: string | null;
  storage_path: string;
  taken_at: string;
  tags: string[];
  created_at: string;
  profiles: { username: string; display_name: string } | null;
  groups: { id: string; name: string } | null;
};

function photoPayload(row: PhotoRow, signedUrl: string) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    owner: row.profiles?.display_name ?? row.profiles?.username ?? "Someone",
    groupId: row.group_id,
    group: row.groups?.name ?? "Ungrouped",
    shareScope: row.share_scope,
    title: row.title,
    caption: row.caption ?? "",
    location: row.location ?? "",
    src: signedUrl,
    storagePath: row.storage_path,
    takenAt: row.taken_at,
    createdAt: row.created_at,
    tags: row.tags ?? []
  };
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseRouteClient(request.headers.get("authorization"));
  const groupId = request.nextUrl.searchParams.get("groupId");
  const ownerId = request.nextUrl.searchParams.get("ownerId");

  let query = supabase
    .from("photos")
    .select("*, profiles!photos_owner_id_fkey(username, display_name), groups(id, name)")
    .order("taken_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (groupId) query = query.eq("group_id", groupId);
  if (ownerId) query = query.eq("owner_id", ownerId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rows = (data ?? []) as PhotoRow[];
  const photos = await Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(row.storage_path, 60 * 60);
      return photoPayload(row, signed?.signedUrl ?? "");
    })
  );

  return NextResponse.json({ photos });
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseRouteClient(request.headers.get("authorization"));
  const body = await request.json();

  const {
    title = "Untitled",
    caption = "",
    location = "",
    groupId = null,
    shareScope = groupId ? "group" : "connections",
    storagePath,
    takenAt = new Date().toISOString(),
    tags = []
  } = body;

  if (!storagePath || typeof storagePath !== "string") {
    return NextResponse.json({ error: "storagePath is required." }, { status: 400 });
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("photos")
    .insert({
      owner_id: user.id,
      group_id: groupId,
      share_scope: shareScope,
      title,
      caption,
      location,
      storage_path: storagePath,
      taken_at: takenAt,
      tags
    })
    .select("*, profiles!photos_owner_id_fkey(username, display_name), groups(id, name)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const row = data as PhotoRow;
  const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(row.storage_path, 60 * 60);

  return NextResponse.json({ photo: photoPayload(row, signed?.signedUrl ?? "") }, { status: 201 });
}
