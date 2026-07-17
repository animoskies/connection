import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase-route";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createSupabaseRouteClient(request.headers.get("authorization"));
  const body = await request.json();

  const { error } = await supabase
    .from("photos")
    .update({
      title: body.title,
      caption: body.caption,
      location: body.location,
      tags: body.tags
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = createSupabaseRouteClient(request.headers.get("authorization"));

  const { data: photo, error: readError } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 400 });
  }

  const { error: deleteError } = await supabase.from("photos").delete().eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  if (photo?.storage_path) {
    await supabase.storage.from("connection-photos").remove([photo.storage_path]);
  }

  return NextResponse.json({ ok: true });
}
