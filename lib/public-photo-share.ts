import { createSupabaseServiceClient } from "@/lib/supabase-service";

export const PUBLIC_PHOTO_BUCKET = "connection-photos";

export type PublicPhotoRow = {
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

export function normalizePublicUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
}

export function isValidPhotoShareToken(token: string) {
  return /^[a-zA-Z0-9_-]{16,80}$/.test(token);
}

export async function getPublicPhotoByToken(token: string) {
  if (!isValidPhotoShareToken(token)) return { photo: null, error: "Share link not found." };

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return { photo: null, error: "Public photo sharing is not configured." };
  }

  const { data: share, error: shareError } = await supabase
    .from("photo_shares")
    .select("photo_id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (shareError) return { photo: null, error: shareError.message };

  if (
    !share ||
    share.revoked_at ||
    (share.expires_at && new Date(share.expires_at).getTime() <= Date.now())
  ) {
    return { photo: null, error: "Share link not found." };
  }

  const { data, error } = await supabase
    .from("photos")
    .select(
      "id, owner_id, title, caption, location, storage_path, taken_at, created_at, profiles!photos_owner_id_fkey(username, display_name, avatar_url)"
    )
    .eq("id", share.photo_id)
    .single();

  if (error || !data) return { photo: null, error: error?.message ?? "Photo not found." };

  return { photo: data as unknown as PublicPhotoRow, error: null };
}

export function publicPhotoPayload(photo: PublicPhotoRow, src: string) {
  return {
    id: photo.id,
    owner: normalizePublicUsername(photo.profiles?.username ?? photo.profiles?.display_name ?? "someone"),
    ownerName: photo.profiles?.display_name ?? "",
    ownerAvatar: photo.profiles?.avatar_url ?? "",
    title: photo.title,
    caption: photo.caption ?? "",
    location: photo.location ?? "",
    src,
    takenAt: photo.taken_at,
    createdAt: photo.created_at
  };
}
