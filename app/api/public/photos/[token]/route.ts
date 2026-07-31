import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

const PHOTO_BUCKET = "connection-photos";

type Params = {
  params: Promise<{ token: string }>;
};

type PublicPhotoRow = {
  id: string;
  owner_id: string;
  title: string;
  caption: string | null;
  location: string | null;
  storage_path: string;
  taken_at: string;
  created_at: string;
  profiles: { username: string; display_name: string; avatar_url: string | null } | null;
};

function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params;

  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(token)) {
    return NextResponse.json({ error: "Share link not found." }, { status: 404 });
  }

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return NextResponse.json({ error: "Public photo sharing is not configured." }, { status: 500 });
  }

  const { data: share, error: shareError } = await supabase
    .from("photo_shares")
    .select("photo_id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (shareError) {
    return NextResponse.json({ error: shareError.message }, { status: 400 });
  }

  if (
    !share ||
    share.revoked_at ||
    (share.expires_at && new Date(share.expires_at).getTime() <= Date.now())
  ) {
    return NextResponse.json({ error: "Share link not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("photos")
    .select("id, owner_id, title, caption, location, storage_path, taken_at, created_at, profiles!photos_owner_id_fkey(username, display_name, avatar_url)")
    .eq("id", share.photo_id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Photo not found." }, { status: 404 });
  }

  const photo = data as unknown as PublicPhotoRow;
  const { data: signed, error: signedError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(photo.storage_path, 60 * 60);

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: signedError?.message ?? "Could not load photo." }, { status: 400 });
  }

  return NextResponse.json({
    photo: {
      id: photo.id,
      owner: normalizeUsername(photo.profiles?.username ?? photo.profiles?.display_name ?? "someone"),
      ownerName: photo.profiles?.display_name ?? "",
      ownerAvatar: photo.profiles?.avatar_url ?? "",
      title: photo.title,
      caption: photo.caption ?? "",
      location: photo.location ?? "",
      src: signed.signedUrl,
      takenAt: photo.taken_at,
      createdAt: photo.created_at
    }
  });
}
