import type { CompanionResult } from "@/lib/companion";

const DEFAULT_MODEL = "gpt-4o-mini";

type CompanionEntry = {
  title: string;
  body: string | null;
  kind: string;
};

type CompanionProject = {
  name: string;
  type: string;
  subtype: string | null;
};

const companionResultSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    body: { type: "string" },
    items: { type: "array", items: { type: "string" } },
    template: { type: ["string", "null"], enum: ["fitness_workout", "audio_studio", "project_notes", null] },
    workout: {
      type: ["object", "null"],
      properties: {
        label: { type: "string" },
        date: { type: "string" },
        focus: { type: "string" },
        summary: { type: "string" },
        days: { type: "array", items: { type: "string" } },
        exercises: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              prescription: { type: "string" }
            },
            required: ["name", "prescription"],
            additionalProperties: false
          }
        }
      },
      required: ["label", "date", "focus", "summary", "days", "exercises"],
      additionalProperties: false
    }
  },
  required: ["title", "body", "items", "template", "workout"],
  additionalProperties: false
};

async function callOpenAI(messages: { role: string; content: string }[], schemaName: string, schema: object) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    body: JSON.stringify({
      messages,
      model,
      response_format: {
        json_schema: { name: schemaName, schema, strict: true },
        type: "json_schema"
      },
      temperature: 0.6
    }),
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`OpenAI request failed (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no content.");
  return JSON.parse(content);
}

export async function generateOpenAICompanionPlan({
  entries,
  project,
  prompt
}: {
  entries: CompanionEntry[];
  project: CompanionProject;
  prompt: string;
}): Promise<CompanionResult> {
  const parsed = await callOpenAI(
    [
      {
        content:
          "You are the companion for a single project inside a personal/group planning app. You only know the ONE project you are given below: its name, type, subtype, and its own recent entries. Never invent context outside of what is given. Keep responses short and practical. For fitness projects, propose one day's session in the \"workout\" field when useful; otherwise set it to null.",
        role: "system"
      },
      {
        content: JSON.stringify({ project, recentEntries: entries.slice(0, 12), userPrompt: prompt || null }),
        role: "user"
      }
    ],
    "companion_result",
    companionResultSchema
  );

  return {
    body: parsed.body,
    items: Array.isArray(parsed.items) ? parsed.items : [],
    template: parsed.template ?? undefined,
    title: parsed.title,
    workout: parsed.workout ?? undefined
  };
}

const programResultSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    body: { type: "string" },
    sessions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          focus: { type: "string" },
          summary: { type: "string" },
          exercises: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                prescription: { type: "string" }
              },
              required: ["name", "prescription"],
              additionalProperties: false
            }
          }
        },
        required: ["focus", "summary", "exercises"],
        additionalProperties: false
      }
    }
  },
  required: ["title", "body", "sessions"],
  additionalProperties: false
};

export async function generateOpenAIProgramPlan({
  daysPerWeek,
  entries,
  project,
  prompt,
  previousSessions
}: {
  daysPerWeek: number;
  entries: CompanionEntry[];
  project: CompanionProject;
  prompt: string;
  previousSessions?: { focus: string; summary: string; exercises: { name: string; prescription: string }[] }[];
}): Promise<CompanionResult> {
  const isRefinement = Boolean(previousSessions?.length);
  const systemPrompt = isRefinement
    ? `You are a fitness coach refining a repeatable weekly training rotation you already built for a single project inside a personal planning app. You only know the ONE project given below and its own recent entries. Never invent context outside of what is given. The user's existing rotation is given as previousSessions — keep whatever still fits and change only what their note asks for. Follow their note precisely on session count: e.g. "add 2 more" means the new rotation should have exactly 2 more sessions than previousSessions had; a specific number mentioned means that many total. Do not include rest days, the app schedules those separately.`
    : `You are a fitness coach building a repeatable weekly training rotation for a single project inside a personal planning app. You only know the ONE project given below: its name, type, subtype, and its own recent entries. Never invent context outside of what is given. Produce exactly ${daysPerWeek} training sessions forming one week's rotation (it repeats every week for the length of the program) — do not include rest days, the app schedules those separately. Keep each session practical and appropriately scoped for the project's subtype.`;

  const parsed = await callOpenAI(
    [
      {
        content: systemPrompt,
        role: "system"
      },
      {
        content: JSON.stringify({
          daysPerWeek,
          previousSessions: previousSessions ?? null,
          project,
          recentEntries: entries.slice(0, 12),
          userNote: prompt || null
        }),
        role: "user"
      }
    ],
    "program_result",
    programResultSchema
  );

  return {
    body: parsed.body,
    items: Array.isArray(parsed.sessions) ? parsed.sessions.map((session: { focus: string }) => session.focus) : [],
    program: { sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [] },
    template: "fitness_workout",
    title: parsed.title
  };
}
