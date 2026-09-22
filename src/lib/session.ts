import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me",
);

const ADMIN_COOKIE = "ic_admin_session";
const CUSTOMER_COOKIE = "ic_customer_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type AdminSessionPayload = {
  adminId: string;
  email: string;
  name: string;
  role: "ADMIN" | "STAFF";
};

export type CustomerSessionPayload = {
  customerId: string;
  email: string;
  name: string | null;
};

async function sign(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret);
}

async function verify<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as T;
  } catch {
    return null;
  }
}

export async function setAdminSession(payload: AdminSessionPayload) {
  const token = await sign(payload);
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const store = await cookies();
  return verify<AdminSessionPayload>(store.get(ADMIN_COOKIE)?.value);
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

export async function setCustomerSession(payload: CustomerSessionPayload) {
  const token = await sign(payload);
  const store = await cookies();
  store.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getCustomerSession(): Promise<CustomerSessionPayload | null> {
  const store = await cookies();
  return verify<CustomerSessionPayload>(store.get(CUSTOMER_COOKIE)?.value);
}

export async function clearCustomerSession() {
  const store = await cookies();
  store.delete(CUSTOMER_COOKIE);
}
