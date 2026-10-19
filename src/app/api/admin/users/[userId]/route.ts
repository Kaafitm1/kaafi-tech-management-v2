import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!token) return NextResponse.json({ error: "Login ayaa loo baahan yahay." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: "Supabase environment variables maqan yihiin." }, { status: 500 });
  const userClient = createClient(url, anon);
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Login-ku ma ansaxayo." }, { status: 401 });
  const admin = createAdminSupabaseClient();
  const { data: actor } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (String(actor?.role || "").toLowerCase() !== "admin") return NextResponse.json({ error: "Admin-ka keliya ayaa role beddeli kara." }, { status: 403 });
  const { userId } = await context.params;
  if (userId === user.id) return NextResponse.json({ error: "Amniga awgiis, role-ka akoonkaaga halkan lagama beddeli karo." }, { status: 400 });
  let body: { role?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Xogta foomku ma saxna." }, { status: 400 }); }
  const role = String(body.role || "").toLowerCase();
  if (!["admin", "registration_staff", "finance_staff", "teacher", "student"].includes(role)) return NextResponse.json({ error: "Role aan la aqoon." }, { status: 400 });
  const { data, error: updateError } = await admin.from("profiles").update({ role, updated_at: new Date().toISOString() }).eq("id", userId).select("id,full_name,role,created_at").single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ user: data });
}
