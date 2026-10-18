import { NextRequest, NextResponse } from "next/server";

import { generateLocalCompanionPlan, generateLocalProgramPlan } from "@/lib/companion";
import { generateOpenAICompanionPlan, generateOpenAIProgramPlan } from "@/lib/ai/openai-companion";
import { createSupabaseRouteClient } from "@/lib/supabase-route";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
  const projectId = cleanText(body.projectId);
  const prompt = cleanText(body.prompt);
  const daysPerWeek = Number(body.daysPerWeek) || 0;
  const previousSessions = Array.isArray(body.previousSessions) ? body.previousSessions : undefined;

  if (!projectId) {
    return NextResponse.json({ error: "Project is required." }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 400 });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  if (project.type === "writing") {
    return NextResponse.json({ error: "Companion for writing is still being shaped." }, { status: 400 });
  }

  const { data: entries, error: entriesError } = await supabase
    .from("project_entries")
    .select("title, body, kind")
    .eq("project_id", projectId)
    .order("occurred_at", { ascending: false })
    .limit(12);

  if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 400 });

  const projectInput = {
    name: project.name,
    subtype: project.subtype,
    type: project.type
  };

  if (daysPerWeek > 0 && project.type === "fitness") {
    const programInput = { daysPerWeek, entries: entries ?? [], previousSessions, project: projectInput, prompt };
    if (process.env.OPENAI_API_KEY) {
      try {
        const result = await generateOpenAIProgramPlan(programInput);
        return NextResponse.json({ result, source: "openai" });
      } catch (error) {
        console.error("OpenAI program generation failed, falling back to local.", error);
      }
    }
    const result = generateLocalProgramPlan(programInput);
    return NextResponse.json({ result, source: "local" });
  }

  const companionInput = { entries: entries ?? [], project: projectInput, prompt };

  if (process.env.OPENAI_API_KEY) {
    try {
      const result = await generateOpenAICompanionPlan(companionInput);
      return NextResponse.json({ result, source: "openai" });
    } catch (error) {
      console.error("OpenAI companion generation failed, falling back to local.", error);
    }
  }

  const result = generateLocalCompanionPlan(companionInput);
  return NextResponse.json({ result, source: "local" });
}
