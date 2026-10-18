type CompanionProject = {
  name: string;
  type: string;
  subtype: string | null;
};

type CompanionEntry = {
  title: string;
  kind: string;
  body: string | null;
};

export type CompanionResult = {
  title: string;
  body: string;
  items: string[];
  template?: "fitness_workout" | "audio_studio" | "project_notes";
  workout?: {
    label: string;
    date: string;
    focus: string;
    summary: string;
    days: string[];
    exercises: { name: string; prescription: string }[];
  };
  program?: {
    sessions: { focus: string; summary: string; exercises: { name: string; prescription: string }[] }[];
  };
};

export type WeekDayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type WeeklyPlanDay = {
  day: WeekDayKey;
  focus: string;
  exercises: { name: string; prescription: string }[];
};

const weekDayKeys: WeekDayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const weeklyPlanTemplates: Record<string, Omit<WeeklyPlanDay, "day">[]> = {
  weight_training: [
    { focus: "chest + triceps", exercises: [
      { name: "bench press", prescription: "4 x 6-8" },
      { name: "incline dumbbell press", prescription: "3 x 8-12" },
      { name: "triceps pushdowns", prescription: "3 x 12-15" }
    ] },
    { focus: "back + biceps", exercises: [
      { name: "pull-ups or lat pulldown", prescription: "4 x 6-10" },
      { name: "barbell row", prescription: "3 x 8-10" },
      { name: "dumbbell curls", prescription: "3 x 10-12" }
    ] },
    { focus: "rest", exercises: [] },
    { focus: "shoulders + core", exercises: [
      { name: "seated shoulder press", prescription: "3 x 8-10" },
      { name: "lateral raises", prescription: "4 x 12-15" },
      { name: "hanging knee raises", prescription: "3 x 12" }
    ] },
    { focus: "legs", exercises: [
      { name: "back squat", prescription: "4 x 6-8" },
      { name: "romanian deadlift", prescription: "3 x 8-10" },
      { name: "walking lunges", prescription: "3 x 12 each leg" }
    ] },
    { focus: "rest", exercises: [] },
    { focus: "rest", exercises: [] }
  ],
  running: [
    { focus: "easy run", exercises: [{ name: "easy pace jog", prescription: "30 min" }] },
    { focus: "rest", exercises: [] },
    { focus: "intervals", exercises: [
      { name: "warmup jog", prescription: "10 min" },
      { name: "intervals", prescription: "6 x 3 min hard, 90 sec walk" },
      { name: "cool down", prescription: "10 min" }
    ] },
    { focus: "easy run", exercises: [{ name: "easy pace jog", prescription: "35 min" }] },
    { focus: "rest", exercises: [] },
    { focus: "long run", exercises: [{ name: "long steady run", prescription: "60-75 min" }] },
    { focus: "rest", exercises: [] }
  ],
  sport: [
    { focus: "skills + drills", exercises: [{ name: "technical drills", prescription: "45 min" }] },
    { focus: "conditioning", exercises: [{ name: "sport-specific conditioning", prescription: "30 min" }] },
    { focus: "rest", exercises: [] },
    { focus: "scrimmage / game prep", exercises: [{ name: "scrimmage or tactical walkthrough", prescription: "45 min" }] },
    { focus: "skills + drills", exercises: [{ name: "technical drills", prescription: "45 min" }] },
    { focus: "game day", exercises: [{ name: "game or match", prescription: "as scheduled" }] },
    { focus: "rest", exercises: [] }
  ],
  mobility: [
    { focus: "full body mobility", exercises: [{ name: "mobility flow", prescription: "20 min" }] },
    { focus: "full body mobility", exercises: [{ name: "mobility flow", prescription: "20 min" }] },
    { focus: "rest", exercises: [] },
    { focus: "full body mobility", exercises: [{ name: "mobility flow", prescription: "20 min" }] },
    { focus: "full body mobility", exercises: [{ name: "mobility flow", prescription: "20 min" }] },
    { focus: "light stretching", exercises: [{ name: "light stretch", prescription: "10 min" }] },
    { focus: "rest", exercises: [] }
  ]
};

const fallbackWeeklyPlanTemplate: Omit<WeeklyPlanDay, "day">[] = [
  { focus: "main session", exercises: [{ name: "main session", prescription: "keep two reps in reserve" }] },
  { focus: "rest", exercises: [] },
  { focus: "main session", exercises: [{ name: "main session", prescription: "repeat the useful parts" }] },
  { focus: "rest", exercises: [] },
  { focus: "short session", exercises: [{ name: "short session", prescription: "stop before it feels heavy" }] },
  { focus: "rest", exercises: [] },
  { focus: "review", exercises: [{ name: "quick review", prescription: "adjust next week" }] }
];

export function defaultWeeklyPlan(subtype: string | null): WeeklyPlanDay[] {
  const template = (subtype && weeklyPlanTemplates[subtype]) || fallbackWeeklyPlanTemplate;
  return weekDayKeys.map((day, index) => ({ day, ...template[index] }));
}

export type ProgramSession = {
  focus: string;
  summary: string;
  exercises: { name: string; prescription: string }[];
};

export function defaultProgramSessions(subtype: string | null, daysPerWeek: number): ProgramSession[] {
  const template = (subtype && weeklyPlanTemplates[subtype]) || fallbackWeeklyPlanTemplate;
  const trainingDays = template.filter((day) => day.focus !== "rest" && day.exercises.length);
  const pool = trainingDays.length ? trainingDays : template;
  return Array.from({ length: daysPerWeek }, (_, index) => {
    const day = pool[index % pool.length];
    return { exercises: day.exercises, focus: day.focus, summary: `${day.focus} session` };
  });
}

export function generateLocalProgramPlan({
  daysPerWeek,
  project,
  prompt,
  previousSessions
}: {
  daysPerWeek: number;
  project: CompanionProject;
  prompt: string;
  previousSessions?: ProgramSession[];
}): CompanionResult {
  let targetCount = daysPerWeek;
  if (previousSessions?.length) {
    const addMatch = prompt.match(/add\s+(\d+)\s+more/i) ?? prompt.match(/(\d+)\s+more/i);
    const removeMatch = prompt.match(/(?:remove|drop|fewer)\s+(\d+)/i);
    if (addMatch) targetCount = previousSessions.length + Number(addMatch[1]);
    else if (removeMatch) targetCount = Math.max(1, previousSessions.length - Number(removeMatch[1]));
    else targetCount = previousSessions.length;
  }
  const sessions = defaultProgramSessions(project.subtype, targetCount);
  return {
    body: prompt.trim()
      ? `A ${targetCount}-day-a-week rotation shaped from this project and your note: ${prompt.trim()}`
      : `A ${targetCount}-day-a-week rotation shaped only from this project.`,
    items: sessions.map((session) => session.focus),
    program: { sessions },
    template: "fitness_workout",
    title: `${targetCount}-day program`
  };
}

export function generateLocalCompanionPlan({
  entries,
  project,
  prompt
}: {
  entries: CompanionEntry[];
  project: CompanionProject;
  prompt: string;
}): CompanionResult {
  const subtype = project.subtype?.replaceAll("_", " ") ?? project.type;
  const recent = entries.slice(0, 3).map((entry) => entry.title).filter(Boolean);
  const recentLine = recent.length ? `Recent notes in this project: ${recent.join(", ")}.` : "No project notes yet.";

  if (project.type === "fitness") {
    const isRunning = project.subtype === "running";
    const exercises = isRunning
      ? [
          { name: "easy warmup jog", prescription: "8 min" },
          { name: "steady intervals", prescription: "5 x 3 min" },
          { name: "walk recovery", prescription: "90 sec between" },
          { name: "light strides", prescription: "4 x 20 sec" },
          { name: "cool down", prescription: "8 min" }
        ]
      : [
          { name: "bench press", prescription: "4 x 6-8" },
          { name: "incline dumbbell press", prescription: "3 x 8-12" },
          { name: "seated shoulder press", prescription: "3 x 8-10" },
          { name: "lateral raises", prescription: "4 x 12-15" },
          { name: "triceps pushdowns", prescription: "3 x 12-15" },
          { name: "hanging knee raises", prescription: "3 x 12" }
        ];

    return {
      title: `${subtype} plan`,
      body: prompt.trim()
        ? `A light plan shaped only from this project and your note: ${prompt.trim()}`
        : `A light plan shaped only from this ${subtype} project.`,
      template: "fitness_workout",
      workout: {
        label: subtype.includes("weight") ? "fat-loss workout tracker" : `${subtype} tracker`,
        date: "today",
        focus: isRunning ? "base run" : "push + core",
        summary: isRunning ? "easy conditioning and clean recovery" : "chest, shoulders, triceps and waist stability",
        days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        exercises
      },
      items: [
        "monday: main session, keep two reps in reserve",
        "tuesday: easy walk or mobility",
        "wednesday: second session, repeat the useful parts",
        "friday: short session, stop before it feels heavy",
        "sunday: quick review and adjust next week"
      ]
    };
  }

  if (project.type === "music") {
    return {
      title: "song sketch",
      body: `${recentLine} Keep the song small enough to finish one honest loop.`,
      template: "audio_studio",
      items: [
        "set bpm and record a rough voice memo",
        "add one instrument stem underneath",
        "write one plain lyric line before polishing",
        "bounce a tiny demo when the idea still feels alive"
      ]
    };
  }

  return {
    title: `${project.name} companion`,
    body: `${recentLine} Companion is using this project only.`,
    template: project.type === "audio" ? "audio_studio" : "project_notes",
    items: [
      "capture one clear next step",
      "keep the next session short",
      "save the useful context here before moving on"
    ]
  };
}
