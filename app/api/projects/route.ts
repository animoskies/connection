import { NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase-route";

const projectTypes = new Set(["fitness", "writing", "audio", "music"]);

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseRouteClient(request.headers.get("authorization"));
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*, groups(name)")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const projects = (data ?? []).map((project) => {
    const group = Array.isArray(project.groups) ? project.groups[0] : project.groups;
    return {
      ...project,
      group_name: group?.name ?? null,
      groups: undefined
    };
  });

  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseRouteClient(request.headers.get("authorization"));
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = cleanText(body.name);
  const type = cleanText(body.type);
  const subtype = cleanText(body.subtype) || null;
  const groupId = cleanText(body.groupId) || null;
  const settings = body.settings && typeof body.settings === "object" ? body.settings : {};

  if (!name) return NextResponse.json({ error: "Project name is required." }, { status: 400 });
  if (!projectTypes.has(type)) return NextResponse.json({ error: "Choose a project type." }, { status: 400 });

  if (groupId) {
    const { data: membership, error: membershipError } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 400 });
    if (!membership) {
      return NextResponse.json({ error: "You need group access to create this project." }, { status: 403 });
    }
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      group_id: groupId,
      name,
      owner_id: user.id,
      settings,
      subtype,
      type
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ project }, { status: 201 });
}
