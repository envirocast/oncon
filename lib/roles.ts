export const APP_ROLES = ["patient", "caregiver", "clinician", "researcher", "administrator"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export function appRoles(metadata: unknown): AppRole[] {
  if (!metadata || typeof metadata !== "object") return [];
  const record = metadata as Record<string, unknown>;
  const roles = [...(Array.isArray(record.roles) ? record.roles : []), record.role];
  return [...new Set(roles.filter((role): role is AppRole => typeof role === "string" && APP_ROLES.includes(role as AppRole)))];
}

export const hasAppRole = (metadata: unknown, role: AppRole): boolean => appRoles(metadata).includes(role);
