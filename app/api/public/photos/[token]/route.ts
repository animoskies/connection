import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { getPublicPhotoByToken, publicPhotoPayload, PUBLIC_PHOTO_BUCKET } from "@/lib/public-photo-share";

type Params = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params;
  const { photo, error } = await getPublicPhotoByToken(token);

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return NextResponse.json({ error: "Public photo sharing is not configured." }, { status: 500 });
  }

  if (!photo) {
    return NextResponse.json({ error: error ?? "Photo not found." }, { status: 404 });
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(PUBLIC_PHOTO_BUCKET)
    .createSignedUrl(photo.storage_path, 60 * 60);

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: signedError?.message ?? "Could not load photo." }, { status: 400 });
  }

  return NextResponse.json({
    photo: publicPhotoPayload(photo, signed.signedUrl)
  });
}
