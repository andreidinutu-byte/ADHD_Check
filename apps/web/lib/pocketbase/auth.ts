import "server-only";
import { ClientResponseError } from "pocketbase";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "./config";
import { createServerPb } from "./server";
import type { AuthClient } from "../../app/api/auth/handlers";

// Parent auth on PocketBase (users collection) behind the same small interface the auth handlers were
// written against: each call answers { data, error } with an error code the handlers map to a response.
// There is no email service, so accounts need no confirmation and there are no email links to verify.

type Answer = { data: object; error: { code: string; status: number } | null };
const ok: Answer = { data: {}, error: null };

function fromPbError(e: unknown, fallback: string): Answer {
  if (e instanceof ClientResponseError) {
    if (e.status === 429) return { data: {}, error: { code: "over_request_rate_limit", status: 429 } };
    const fields = (e.response?.data ?? {}) as Record<string, { code?: string }>;
    if (fields.password?.code?.startsWith("validation_")) return { data: {}, error: { code: "weak_password", status: 400 } }; // check-secrets: allow
    if (fields.email?.code === "validation_not_unique") return ok; // same answer for a known address
    if (e.status === 400) return { data: {}, error: { code: fallback, status: 400 } };
    return { data: {}, error: { code: "unexpected_failure", status: e.status || 502 } };
  }
  return { data: {}, error: { code: "unexpected_failure", status: 502 } };
}

async function writeCookie(value: string | null) {
  const store = await cookies();
  if (value === null) {
    store.delete(AUTH_COOKIE);
    return;
  }
  store.set(AUTH_COOKIE, value, {
    httpOnly: false, // Client Components send this login to PocketBase themselves
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function createPbAuth(): Promise<AuthClient> {
  const pb = await createServerPb();
  return {
    async signUp({ email, password }: { email: string; password: string }) { // check-secrets: allow
      try {
        await pb.collection("users").create({ email, password, passwordConfirm: password }); // check-secrets: allow
        return ok;
      } catch (e) {
        return fromPbError(e, "invalid_input");
      }
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) { // check-secrets: allow
      try {
        await pb.collection("users").authWithPassword(email, password); // check-secrets: allow
        // The SDK cookie format (token + record) that the browser client reads back.
        const exported = pb.authStore.exportToCookie({}, AUTH_COOKIE);
        await writeCookie(decodeURIComponent(exported.slice(AUTH_COOKIE.length + 1).split(";")[0]));
        return ok;
      } catch (e) {
        if (e instanceof ClientResponseError && e.status === 400) {
          return { data: {}, error: { code: "invalid_credentials", status: 400 } };
        }
        return fromPbError(e, "invalid_credentials");
      }
    },
    async signOut() {
      pb.authStore.clear();
      await writeCookie(null);
      return ok;
    },
    async verifyOtp() {
      return { data: {}, error: { code: "otp_disabled", status: 400 } };
    },
  } as unknown as AuthClient;
}
