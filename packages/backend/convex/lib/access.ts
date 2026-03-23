import { createAccessControl } from "better-auth/plugins/access";

/**
 * Access control statements — defines all resources and their allowed actions.
 * Used by the admin plugin to check permissions per role.
 */
export const ac = createAccessControl({
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "delete",
    "set-password",
    "get",
    "update",
  ],
  session: ["list", "revoke", "delete"],
  patients: ["read", "write", "assign"],
  dashboard: ["read"],
  metrics: ["read"],
});

export const superAdminRole = ac.newRole({
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "delete",
    "set-password",
    "get",
    "update",
  ],
  session: ["list", "revoke", "delete"],
  patients: ["read", "write", "assign"],
  dashboard: ["read"],
  metrics: ["read"],
});

export const userRole = ac.newRole({
  dashboard: ["read"],
  metrics: ["read"],
});

export const doctorRole = ac.newRole({
  dashboard: ["read"],
  patients: ["read"],
});
