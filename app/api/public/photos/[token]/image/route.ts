import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { getPublicPhotoByToken, PUBLIC_PHOTO_BUCKET } from "@/lib/public-photo-share";

type Params = {
  params: Promise<{ token: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params;
  const { photo, error } = await getPublicPhotoByToken(token);

  if (!photo) {
    return NextResponse.json({ error: error ?? "Share link not found." }, { status: 404 });
  }

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return NextResponse.json({ error: "Public photo sharing is not configured." }, { status: 500 });
  }

  const { data, error: downloadError } = await supabase.storage
    .from(PUBLIC_PHOTO_BUCKET)
    .download(photo.storage_path);

  if (downloadError || !data) {
    return NextResponse.json({ error: downloadError?.message ?? "Could not load photo." }, { status: 404 });
  }

  return new NextResponse(data, {
    headers: {
      "Content-Type": data.type || "image/jpeg",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Content-Disposition": "inline"
    }
  });
}
