import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase-route";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

type BetaRequestRow = {
  email: string;
  requested_at: string;
  approved_at: string | null;
};

const defaultAdminUsernames = ["animoskies"];

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function betaAdminUsernames() {
  return (process.env.BETA_ADMIN_USERNAMES ?? defaultAdminUsernames.join(","))
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

async function currentAdminId(request: NextRequest) {
  const routeClient = createSupabaseRouteClient(request.headers.get("authorization"));
  const serviceClient = createSupabaseServiceClient();

  const {
    data: { user },
    error
  } = await routeClient.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, username")
    .eq("id", user.id)
    .maybeSingle();

  const username = String(profile?.username ?? "").toLowerCase();
  return betaAdminUsernames().includes(username) ? user.id : null;
}

export async function GET(request: NextRequest) {
  let serviceClient;
  try {
    serviceClient = createSupabaseServiceClient();
  } catch {
    return NextResponse.json({ error: "Beta access is not configured." }, { status: 500 });
  }

  const email = normalizeEmail(request.nextUrl.searchParams.get("email"));
  if (email) {
    if (!isEmail(email)) return NextResponse.json({ approved: false });

    const { data } = await serviceClient.from("beta_access").select("email").eq("email", email).maybeSingle();
    return NextResponse.json({ approved: Boolean(data?.email) });
  }

  const adminId = await currentAdminId(request);
  if (!adminId) {
    return NextResponse.json({ error: "Only beta admins can view requests." }, { status: 403 });
  }

  const { data, error } = await serviceClient
    .from("beta_requests")
    .select("email, requested_at, approved_at")
    .is("approved_at", null)
    .order("requested_at", { ascending: false })
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    requests: ((data ?? []) as BetaRequestRow[]).map((requestRow) => ({
      email: requestRow.email,
      requestedAt: requestRow.requested_at,
      approvedAt: requestRow.approved_at
    }))
  });
}

export async function POST(request: NextRequest) {
  let serviceClient;
  try {
    serviceClient = createSupabaseServiceClient();
  } catch {
    return NextResponse.json({ error: "Beta access is not configured." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!isEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const { data: approved } = await serviceClient.from("beta_access").select("email").eq("email", email).maybeSingle();
  if (approved?.email) return NextResponse.json({ approved: true });

  const { error } = await serviceClient
    .from("beta_requests")
    .upsert({ email, requested_at: new Date().toISOString() }, { onConflict: "email" });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ requested: true });
}

export async function PATCH(request: NextRequest) {
  let serviceClient;
  try {
    serviceClient = createSupabaseServiceClient();
  } catch {
    return NextResponse.json({ error: "Beta access is not configured." }, { status: 500 });
  }

  const adminId = await currentAdminId(request);
  if (!adminId) {
    return NextResponse.json({ error: "Only beta admins can approve requests." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!isEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: accessError } = await serviceClient
    .from("beta_access")
    .upsert({ email, approved_at: now, approved_by: adminId }, { onConflict: "email" });

  if (accessError) return NextResponse.json({ error: accessError.message }, { status: 400 });

  await serviceClient.from("beta_requests").update({ approved_at: now, approved_by: adminId }).eq("email", email);

  return NextResponse.json({ approved: true });
}
