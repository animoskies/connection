import { NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase-route";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createSupabaseRouteClient(request.headers.get("authorization"));
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body.settings || typeof body.settings !== "object") {
    return NextResponse.json({ error: "Settings payload is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .update({ settings: body.settings, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Only the project owner can update this." }, { status: 403 });

  return NextResponse.json({ project: data });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createSupabaseRouteClient(request.headers.get("authorization"));
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { error: eventsError } = await supabase.from("events").delete().eq("project_id", id).eq("owner_id", user.id);
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 400 });

  const { data, error } = await supabase.from("projects").delete().eq("id", id).eq("owner_id", user.id).select("id").maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Only the project owner can delete this." }, { status: 403 });

  return NextResponse.json({ ok: true });
}
