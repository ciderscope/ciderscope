import { describe, expect, it } from "vitest";
import { canAccessOwner } from "../authz";
import type { AuthUser } from "../../services/auth";

const user = (id: string, role: AuthUser["role"]): AuthUser => ({
  id,
  entityId: id,
  name: id,
  role,
  capabilities: {
    calendar: role === "superadmin",
    mailing: role === "superadmin",
  },
});

describe("admin entity isolation", () => {
  it("limits a standard admin to their own entity", () => {
    const admin = user("entity-a", "admin");
    expect(canAccessOwner(admin, "entity-a")).toBe(true);
    expect(canAccessOwner(admin, "entity-b")).toBe(false);
    expect(canAccessOwner(admin, null)).toBe(false);
  });

  it("allows the IFPC superadmin to inspect every entity", () => {
    const superadmin = user("ifpc", "superadmin");
    expect(canAccessOwner(superadmin, "ifpc")).toBe(true);
    expect(canAccessOwner(superadmin, "entity-b")).toBe(true);
  });
});
