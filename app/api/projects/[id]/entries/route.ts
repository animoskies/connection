import { NextRequest, NextResponse } from "next/server";

import { createSupabaseRouteClient } from "@/lib/supabase-route";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const entryKinds = new Set(["workout", "journal", "draft", "voice_memo", "stem", "lyrics"]);
const AUDIO_BUCKET = "project-audio";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function withMediaUrls(supabase: ReturnType<typeof createSupabaseRouteClient>, entries: { media_path: string | null }[]) {
  const paths = entries.map((entry) => entry.media_path).filter((path): path is string => Boolean(path));
  if (!paths.length) return entries.map((entry) => ({ ...entry, media_url: null }));

  const { data: signedUrls } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrls(paths, 60 * 60);
  const urlByPath = new Map((signedUrls ?? []).map((signed) => [signed.path, signed.signedUrl]));

  return entries.map((entry) => ({ ...entry, media_url: entry.media_path ? (urlByPath.get(entry.media_path) ?? null) : null }));
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
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
    .select("*")
    .eq("project_id", id)
    .order("occurred_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const entries = await withMediaUrls(supabase, data ?? []);
  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest, context: RouteContext) {
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
  const title = cleanText(body.title);
  const bodyText = cleanText(body.body) || null;
  const kind = cleanText(body.kind);
  const occurredAt = cleanText(body.occurredAt) || new Date().toISOString();
  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  const mediaPath = cleanText(body.mediaPath) || null;

  if (!title) return NextResponse.json({ error: "Entry title is required." }, { status: 400 });
  if (!entryKinds.has(kind)) return NextResponse.json({ error: "Choose an entry type." }, { status: 400 });
  if (mediaPath && !mediaPath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Invalid media path." }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabase.from("projects").select("id").eq("id", id).maybeSingle();
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 400 });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { data: entry, error } = await supabase
    .from("project_entries")
    .insert({
      body: bodyText,
      kind,
      media_path: mediaPath,
      metadata,
      occurred_at: occurredAt,
      owner_id: user.id,
      project_id: id,
      title
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const [entryWithUrl] = await withMediaUrls(supabase, [entry]);
  return NextResponse.json({ entry: entryWithUrl }, { status: 201 });
}
