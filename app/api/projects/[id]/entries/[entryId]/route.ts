import { NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase-route";

type RouteContext = {
  params: Promise<{ id: string; entryId: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id, entryId } = await context.params;
  const supabase = createSupabaseRouteClient(request.headers.get("authorization"));
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("project_entries")
    .delete()
    .eq("id", entryId)
    .eq("project_id", id)
    .eq("owner_id", user.id)
    .select("id, media_path")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Only the entry owner can delete this." }, { status: 403 });

  if (data.media_path) {
    await supabase.storage.from("project-audio").remove([data.media_path]);
  }

  return NextResponse.json({ ok: true });
}
