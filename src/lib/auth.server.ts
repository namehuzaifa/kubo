// Server-side session and role resolution for the admin dashboard and the
// customer portal.
//
// The generated requireSupabaseAuth middleware throws when no bearer token is
// present, which is right for a protected RPC but wrong for "who am I?" checks
// that must be able to answer "nobody". These helpers resolve the caller
// without throwing, then look the role up with the service-role client so a
// client-supplied token can never claim a role it does not have.
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

import type { AppDatabase, AppRole } from "@/integrations/supabase/admin-schema";

export type SessionUser = {
  userId: string;
  email: string | null;
  /** Display name, set at sign-up and editable from the profile pages. */
  name: string | null;
  roles: AppRole[];
  isStaff: boolean;
  isAdmin: boolean;
};

/** Service-role client. Bypasses RLS — never hand this to client code. */
export function adminDb() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add the service role key to .env — the admin dashboard cannot write without it.",
    );
  }
  return createClient<AppDatabase>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** The service-role client's type, for modules that receive it as an argument. */
export type AdminDb = ReturnType<typeof adminDb>;

function bearerToken(): string | null {
  const request = getRequest();
  const header = request?.headers?.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  // Supabase access tokens are JWTs; anything else is not a session.
  return token && token.split(".").length === 3 ? token : null;
}

/** Resolves the caller, or null when the request is anonymous. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = bearerToken();
  if (!token) return null;

  const url = process.env["SUPABASE_URL"];
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishableKey) return null;

  const scoped = createClient<AppDatabase>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", publishableKey);
        return fetch(input, { ...init, headers });
      },
    },
  });

  const { data, error } = await scoped.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  const db = adminDb();
  const { data: roleRows } = await db.from("user_roles").select("role").eq("user_id", userId);

  const roles = (roleRows ?? []).map((row) => row.role);
  // The display name rides along in the token's user metadata, so reading it
  // here costs no extra round trip.
  const metadata = data.claims["user_metadata"] as { full_name?: unknown } | undefined;

  return {
    userId,
    email: typeof data.claims["email"] === "string" ? (data.claims["email"] as string) : null,
    name: typeof metadata?.full_name === "string" ? metadata.full_name : null,
    roles,
    isStaff: roles.includes("admin") || roles.includes("staff"),
    isAdmin: roles.includes("admin"),
  };
}

/** Resolves the caller and refuses anyone who is not admin or staff. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized: sign in required");
  if (!user.isStaff) throw new Error("Forbidden: staff access required");
  return user;
}

/** Resolves the caller and refuses anyone who is not an admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized: sign in required");
  if (!user.isAdmin) throw new Error("Forbidden: admin access required");
  return user;
}

/** The customer record linked to the caller, or null if they have none yet. */
export async function currentCustomerId(userId: string): Promise<string | null> {
  const db = adminDb();
  const { data } = await db.from("customers").select("id").eq("auth_user_id", userId).maybeSingle();
  return data?.id ?? null;
}
