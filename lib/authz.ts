import type { AuthUser } from "../services/auth";

export const canAccessOwner = (
  user: AuthUser,
  ownerId: string | null | undefined
) => user.role === "superadmin" || Boolean(ownerId && ownerId === user.entityId);
