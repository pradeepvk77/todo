import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET_KEY = process.env.SESSION_SECRET || "default_fallback_session_secret_change_in_production_32_bytes";
const encodedKey = new TextEncoder().encode(SECRET_KEY);

export type UserIdentifier = "user1" | "user2";

export interface SessionPayload {
  userId: UserIdentifier;
  expiresAt: Date;
}

export async function encrypt(payload: { userId: UserIdentifier; expiresAt: Date }): Promise<string> {
  return new SignJWT({ userId: payload.userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(encodedKey);
}

export async function decrypt(sessionToken: string | undefined = ""): Promise<{ userId: UserIdentifier } | null> {
  if (!sessionToken) return null;
  try {
    const { payload } = await jwtVerify(sessionToken, encodedKey, {
      algorithms: ["HS256"],
    });
    if (payload.userId === "user1" || payload.userId === "user2") {
      return { userId: payload.userId as UserIdentifier };
    }
    return null;
  } catch {
    return null;
  }
}

export async function createSession(userId: UserIdentifier) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const sessionToken = await encrypt({ userId, expiresAt });
  const cookieStore = await cookies();

  cookieStore.set("session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function getSession(): Promise<{ userId: UserIdentifier } | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;
  return decrypt(sessionToken);
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
