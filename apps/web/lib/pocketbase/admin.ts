import "server-only";
import PocketBase from "pocketbase";
import { serverPbUrl } from "./server-url";

// Superuser client for writes no parent may do (sessions, play links, purchases, waitlist, demo seed).
// Server code only (NFR-12): the `server-only` import fails the build if a Client Component imports this.
// The superuser token is cached for the process; every call gets its own client, so requests never share
// an auth store or cancel each other.
let cached: { jwt: string; until: number } | null = null;

export class StorageUnavailableError extends Error {
  constructor(message = "PocketBase admin settings are not set") {
    super(message);
    this.name = "StorageUnavailableError";
  }
}

export function hasAdminSettings(): boolean {
  return Boolean(process.env.PB_ADMIN_EMAIL && process.env.PB_ADMIN_PASSWORD); // check-secrets: allow
}

export async function createAdminPb(): Promise<PocketBase> {
  const email = process.env.PB_ADMIN_EMAIL;
  const pw = process.env.PB_ADMIN_PASSWORD; // check-secrets: allow
  if (!email || !pw) throw new StorageUnavailableError(); // check-secrets: allow
  const pb = new PocketBase(serverPbUrl());
  pb.autoCancellation(false);
  if (cached && cached.until > Date.now()) {
    pb.authStore.save(cached.jwt, null);
    return pb;
  }
  const auth = await pb.collection("_superusers").authWithPassword(email, pw); // check-secrets: allow
  // Superuser tokens last a day by default; renew well before that.
  cached = { jwt: auth.token, until: Date.now() + 6 * 60 * 60 * 1000 }; // check-secrets: allow
  return pb;
}

// For tests.
export function clearAdminAuthCache() {
  cached = null;
}
