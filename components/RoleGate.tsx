"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useSync } from "@/components/SyncProvider";
import { hasAppRole, type AppRole } from "@/lib/roles";

export default function RoleGate({ role, children }: { role: AppRole; children: ReactNode }) {
  const { configured, user, ready } = useSync();
  if (!ready) return null;
  if (!configured) return <div className="card"><h2>Secure account access is not configured</h2><p>This role-specific workflow requires Supabase authentication and the current database migrations.</p></div>;
  if (!user) return <div className="card"><h2>Sign in required</h2><p>Sign in to your approved {role} account to use this workspace.</p><Link className="btn" href="/account">Account and sign in</Link></div>;
  if (!hasAppRole(user.app_metadata, role)) {
    return <div className="card"><h2>Access not provisioned</h2><p>This account does not have the {role} role. Roles are assigned by an administrator after identity and eligibility checks; profile settings cannot grant access.</p><Link className="btn alt" href="/account">Account details</Link></div>;
  }
  return <>{children}</>;
}
