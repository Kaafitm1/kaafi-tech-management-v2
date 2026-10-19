
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MODULES = [
  "dashboard",
  "students",
  "courses",
  "classes",
  "attendance",
  "payments",
  "student_reports",
  "attendance_reports",
  "books",
  "staff_users",
  "settings",
] as const;

const ACTIONS = ["view", "create", "edit", "delete", "export"] as const;

function emptyPermissions() {
  return Object.fromEntries(
    MODULES.map((module) => [
      module,
      Object.fromEntries(ACTIONS.map((action) => [action, false])),
    ])
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function authorize(request: Request) {
  const token = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return { error: "Login ayaa loo baahan yahay.", status: 401 };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { error: "Supabase environment variables maqan yihiin.", status: 500 };
  }

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authError } = await client.auth.getUser(token);

  if (authError || !user) {
    return { error: "Login-ku ma ansaxayo.", status: 401 };
  }

  let admin: ReturnType<typeof createAdminSupabaseClient>;

  try {
    admin = createAdminSupabaseClient();
  } catch {
    return { error: "Supabase server environment variables maqan yihiin.", status: 500 };
  }

  const { data: profile, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || String(profile?.role || "").toLowerCase() !== "admin") {
    return { error: "Admin-ka keliya ayaa maamuli kara rukhsadaha.", status: 403 };
  }

  return { admin, actorId: user.id };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const auth = await authorize(request);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userId } = await context.params;

  const { data: target, error: targetError } = await auth.admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (targetError || !target) {
    return NextResponse.json({ error: "Isticmaalaha lama helin." }, { status: 404 });
  }

  const { data, error } = await auth.admin
    .from("user_permissions")
    .select("permissions, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Rukhsadaha lama soo qaadi karin." }, { status: 500 });
  }

  return NextResponse.json({
    userId,
    permissions: {
      ...emptyPermissions(),
      ...(isObject(data?.permissions) ? data.permissions : {}),
    },
    updatedAt: data?.updated_at ?? null,
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const auth = await authorize(request);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userId } = await context.params;

  let body: { permissions?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Xogta la diray ma saxna." }, { status: 400 });
  }

  if (!isObject(body.permissions)) {
    return NextResponse.json({ error: "Rukhsadaha la diray ma saxna." }, { status: 400 });
  }

  const permissions = emptyPermissions();

  for (const module of MODULES) {
    const supplied = body.permissions[module];

    if (supplied === undefined) continue;

    if (!isObject(supplied)) {
      return NextResponse.json({ error: `Rukhsadaha ${module} ma saxna.` }, { status: 400 });
    }

    for (const action of Object.keys(supplied)) {
      if (!(ACTIONS as readonly string[]).includes(action)) {
        return NextResponse.json({ error: `Ficil aan la aqoon: ${action}.` }, { status: 400 });
      }

      if (typeof supplied[action] !== "boolean") {
        return NextResponse.json({ error: `Rukhsadda ${module}.${action} waa inay noqotaa true ama false.` }, { status: 400 });
      }

      (permissions[module] as Record<string, boolean>)[action] =
        supplied[action] as boolean;
    }
  }

  const unknownModules = Object.keys(body.permissions).filter(
    (key) => !(MODULES as readonly string[]).includes(key)
  );

  if (unknownModules.length) {
    return NextResponse.json({ error: "Waxaa jira qaybo rukhsado oo aan la aqoon." }, { status: 400 });
  }

  const { data: target, error: targetError } = await auth.admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (targetError || !target) {
    return NextResponse.json({ error: "Isticmaalaha lama helin." }, { status: 404 });
  }

  const { error } = await auth.admin
    .from("user_permissions")
    .upsert({
      user_id: userId,
      permissions,
      updated_at: new Date().toISOString(),
      updated_by: auth.actorId,
    }, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: "Rukhsadaha lama kaydin karin." }, { status: 500 });
  }

  return NextResponse.json({
    message: "Rukhsadaha waa la kaydiyey.",
    userId,
    permissions,
  });
}
