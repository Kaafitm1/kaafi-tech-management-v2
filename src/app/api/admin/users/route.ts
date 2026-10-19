
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const ALLOWED_ROLES = [
  "admin",
  "registration_staff",
  "finance_staff",
  "teacher",
  "student",
] as const;

async function authorize(request: Request) {
  const token = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return {
      error: "Login ayaa loo baahan yahay.",
      status: 401,
    } as const;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      error: "Supabase environment variables maqan yihiin.",
      status: 500,
    } as const;
  }

  const userClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser(token);

  if (authError || !user) {
    return {
      error: "Login-ku ma ansaxayo. Fadlan mar kale gal.",
      status: 401,
    } as const;
  }

  let admin: ReturnType<typeof createAdminSupabaseClient>;

  try {
    admin = createAdminSupabaseClient();
  } catch {
    return {
      error: "Supabase server environment variables maqan yihiin.",
      status: 500,
    } as const;
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    String(profile?.role ?? "").toLowerCase() !== "admin"
  ) {
    return {
      error: "Admin-ka keliya ayaa maamuli kara akoonnada.",
      status: 403,
    } as const;
  }

  return { admin };
}

export async function GET(request: Request) {
  try {
    const auth = await authorize(request);

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const { data, error } = await auth.admin
      .from("profiles")
      .select("id, full_name, role, created_at")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Admin users GET error:", error.message);

      return NextResponse.json(
        { error: "Liiska akoonnada lama soo qaadi karin." },
        { status: 500 }
      );
    }

    return NextResponse.json({ users: data ?? [] });
  } catch (error) {
    console.error("Unexpected admin users GET error:", error);

    return NextResponse.json(
      { error: "Khalad ayaa dhacay markii akoonnada la soo qaadayay." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorize(request);

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    let body: {
      full_name?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Xogta foomku ma saxna." },
        { status: 400 }
      );
    }

    const full_name =
      typeof body.full_name === "string"
        ? body.full_name.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const role =
      typeof body.role === "string"
        ? body.role.trim().toLowerCase()
        : "";

    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (
      !full_name ||
      !validEmail ||
      password.length < 8 ||
      !ALLOWED_ROLES.includes(
        role as (typeof ALLOWED_ROLES)[number]
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Hubi magaca, email sax ah, password ugu yaraan 8 xaraf ah, iyo role sax ah.",
        },
        { status: 400 }
      );
    }

    const { data: created, error: createError } =
      await auth.admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

    if (createError || !created.user) {
      return NextResponse.json(
        {
          error:
            createError?.message ||
            "Akoonka lama abuuri karin.",
        },
        { status: 400 }
      );
    }

    const { error: profileError } = await auth.admin
      .from("profiles")
      .upsert(
        {
          id: created.user.id,
          full_name,
          role,
        },
        { onConflict: "id" }
      );

    if (profileError) {
      const { error: rollbackError } =
        await auth.admin.auth.admin.deleteUser(created.user.id);

      console.error("Profile creation error:", profileError.message);

      return NextResponse.json(
        {
          error: rollbackError
            ? "Profile lama kaydin, akoonkii Auth-na si toos ah looma tirtiri karin. Fadlan hubi Supabase."
            : `Profile lama kaydin: ${profileError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        user: {
          id: created.user.id,
          full_name,
          email,
          role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected admin users POST error:", error);

    return NextResponse.json(
      { error: "Khalad lama filaan ah ayaa dhacay. Mar kale isku day." },
      { status: 500 }
    );
  }
}
