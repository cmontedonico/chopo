import { describe, expect, test } from "bun:test";

import { resolveCurrentUserState } from "./current-user-state";

describe("resolveCurrentUserState", () => {
  test("keeps authenticated users in loading state while the current user query is still resolving", () => {
    const state = resolveCurrentUserState({
      authIsLoading: false,
      convexAuthenticated: true,
      user: undefined,
    });

    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(true);
    expect(state.role).toBeNull();
  });

  test("marks unauthenticated users only after Convex auth finishes resolving", () => {
    const state = resolveCurrentUserState({
      authIsLoading: false,
      convexAuthenticated: false,
      user: undefined,
    });

    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  test("preserves the resolved role for authenticated users", () => {
    const state = resolveCurrentUserState({
      authIsLoading: false,
      convexAuthenticated: true,
      user: { role: "user" },
    });

    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.role).toBe("user");
    expect(state.hasRole("user")).toBe(true);
  });
});
