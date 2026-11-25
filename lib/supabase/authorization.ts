import { supabaseServer } from "./server";
import { appRoles, type AppRole } from "../roles";

export async function authorizeRoles(required: readonly AppRole[]) {
  const supabase = await supabaseServer();
  if (!supabase) return { ok: false as const, status: 503, error: "Cloud authentication is not configured." };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, status: 401, error: "Sign in is required." };
  const roles = appRoles(data.user.app_metadata);
  if (!roles.some(role => required.includes(role))) {
    return { ok: false as const, status: 403, error: "This account does not have permission for this action." };
  }
  return { ok: true as const, supabase, user: data.user, roles };
}
