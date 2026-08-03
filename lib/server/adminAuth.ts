import { NextResponse } from "next/server";
import { loginWithToken, type AuthSession, type AuthUser } from "../../services/auth";
export { canAccessOwner } from "../authz";

const DEFAULT_SHARED_COOKIE = "senso_sso_token";
const isEnabled = (value: string | undefined) => /^(1|true|yes)$/i.test(value || "");

const sharedCookieName = () => {
  const configured = process.env.SSO_SHARED_COOKIE_NAME?.trim();
  return configured && /^[A-Za-z0-9_.-]+$/.test(configured)
    ? configured
    : DEFAULT_SHARED_COOKIE;
};

const readCookie = (header: string | null, name: string) => {
  if (!header) return "";
  for (const entry of header.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    if (entry.slice(0, separator).trim() !== name) continue;
    const value = entry.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return "";
};

export const getRequestAuthToken = (request: Request) => {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (match?.[1]?.trim()) return match[1].trim();
  const sharedToken = readCookie(request.headers.get("cookie"), sharedCookieName());
  if (sharedToken) return sharedToken;
  if (!isEnabled(process.env.SSO_MOCK_ENABLED)) return "";
  const id = process.env.SSO_MOCK_USER_ID?.trim() || "ifpc";
  const role = process.env.SSO_MOCK_ROLE?.trim() || "superadmin";
  const name = encodeURIComponent(process.env.SSO_MOCK_USER_NAME?.trim() || "IFPC");
  return `mock:${id}:${role}:${name}`;
};

export const authenticateRequest = async (request: Request): Promise<AuthSession | null> => {
  const token = getRequestAuthToken(request);
  if (!token) return null;
  try {
    return await loginWithToken(token);
  } catch {
    return null;
  }
};

export type AdminAuthResult =
  | { ok: true; user: AuthUser; token: string }
  | { ok: false; response: NextResponse };

export const requireAdmin = async (request: Request): Promise<AdminAuthResult> => {
  const session = await authenticateRequest(request);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin authentication required." }, { status: 401 }),
    };
  }
  return { ok: true, ...session };
};

export const requireSuperadmin = async (request: Request): Promise<AdminAuthResult> => {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth;
  if (auth.user.role !== "superadmin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Superadmin access required." }, { status: 403 }),
    };
  }
  return auth;
};
