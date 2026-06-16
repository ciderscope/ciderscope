import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ADMIN_COOKIE = "ciderscope_admin";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

type AdminPayload = {
  user: string;
  nonce: string;
  exp: number;
};

const base64UrlEncode = (value: string | Buffer) => Buffer.from(value).toString("base64url");
const base64UrlDecode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

const getSecret = () => {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "ciderscope-local-admin-secret"
  );
};

const sign = (payload: string) => {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
};

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export const createAdminSessionToken = (user: string) => {
  const payload: AdminPayload = {
    user,
    nonce: randomBytes(12).toString("hex"),
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
};

export const verifyAdminSessionToken = (token?: string) => {
  if (!token) return false;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !safeEqual(signature, sign(encoded))) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as AdminPayload;
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
};

export const setAdminCookie = (response: NextResponse, token: string) => {
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
};

export const clearAdminCookie = (response: NextResponse) => {
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
};

export const isAdminRequest = async () => {
  const store = await cookies();
  return verifyAdminSessionToken(store.get(ADMIN_COOKIE)?.value);
};

export const requireAdmin = async () => {
  if (await isAdminRequest()) return null;
  return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });
};

export const isValidAdminCredentials = (login: string, password: string) => {
  const expectedLogin = process.env.ADMIN_USERNAME || "ifpc";
  const expectedPassword = process.env.ADMIN_PASSWORD || "ifpc";
  return login.trim().toLowerCase() === expectedLogin.trim().toLowerCase() && password === expectedPassword;
};
