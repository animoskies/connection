import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase-route";

type Params = {
  params: Promise<{ id: string }>;
};

function appUrl(request: NextRequest, path: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    request.nextUrl.origin;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function shareToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createSupabaseRouteClient(request.headers.get("authorization"));

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: photo, error: photoError } = await supabase
    .from("photos")
    .select("id, owner_id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (photoError || !photo) {
    return NextResponse.json({ error: "Only the photo owner can share this photo." }, { status: 403 });
  }

  const { data: existingShare, error: existingError } = await supabase
    .from("photo_shares")
    .select("token")
    .eq("photo_id", id)
    .eq("owner_id", user.id)
    .is("revoked_at", null)
    .is("expires_at", null)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 400 });
  }

  if (existingShare?.token) {
    return NextResponse.json({ url: appUrl(request, `/p/${existingShare.token}`), token: existingShare.token });
  }

  const { data: createdShare, error: createError } = await supabase
    .from("photo_shares")
    .insert({
      photo_id: id,
      owner_id: user.id,
      token: shareToken()
    })
    .select("token")
    .single();

  if (createError || !createdShare?.token) {
    return NextResponse.json({ error: createError?.message ?? "Could not create share link." }, { status: 400 });
  }

  return NextResponse.json({ url: appUrl(request, `/p/${createdShare.token}`), token: createdShare.token }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createSupabaseRouteClient(request.headers.get("authorization"));

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { error } = await supabase
    .from("photo_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("photo_id", id)
    .eq("owner_id", user.id)
    .is("revoked_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
