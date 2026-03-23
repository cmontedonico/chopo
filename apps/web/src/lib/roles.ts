export const ROLES = ["super_admin", "user", "doctor"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  user: "Usuario",
  doctor: "Doctor",
};
