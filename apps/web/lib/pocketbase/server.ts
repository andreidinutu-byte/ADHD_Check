import "server-only";
import PocketBase from "pocketbase";
import { cookies, headers } from "next/headers";
import { AUTH_COOKIE, PUBLIC_PB_URL } from "./config";
import { serverPbUrl } from "./server-url";

// PocketBase client for Server Components and Route Handlers acting as the logged-in parent (API rules
// apply). A new client per request; never keep one in a module variable.
// PocketBase rate-limits per client address. Server calls all come from the web server, so the parent's
// own address is passed on in CF-Connecting-IP, the header PocketBase is set to read.
export async function createServerPb(): Promise<PocketBase> {
  const cookieStore = await cookies();
  const h = await headers();
  const pb = new PocketBase(serverPbUrl());
  pb.autoCancellation(false);
  const raw = cookieStore.get(AUTH_COOKIE)?.value;
  if (raw) pb.authStore.loadFromCookie(`${AUTH_COOKIE}=${raw}`, AUTH_COOKIE);
  const clientIp = h.get("cf-connecting-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  // Only on a direct connection (PB_URL set to the database's own address): Cloudflare refuses requests
  // that carry this header themselves, so it is never sent through the public URL.
  if (clientIp && serverPbUrl() !== PUBLIC_PB_URL) {
    pb.beforeSend = (url, options) => {
      options.headers = { ...(options.headers as Record<string, string>), "CF-Connecting-IP": clientIp };
      return { url, options };
    };
  }
  return pb;
}

// Verified parent id: the cookie can be edited by its owner, so the token is checked with PocketBase
// (authRefresh) instead of trusting the record stored next to it. Results are cached briefly per token.
const verified = new Map<string, { id: string; email: string; until: number }>();
const VERIFY_TTL_MS = 60_000;

export type Parent = { id: string; email: string };

export async function verifyParent(pb: PocketBase): Promise<Parent | null> {
  const jwt = pb.authStore.token; // check-secrets: allow
  if (!jwt || !pb.authStore.isValid) return null;
  const hit = verified.get(jwt);
  if (hit && hit.until > Date.now()) return { id: hit.id, email: hit.email };
  try {
    const auth = await pb.collection("users").authRefresh();
    const parent = { id: auth.record.id, email: String(auth.record.email ?? "") };
    if (verified.size > 1000) verified.clear();
    verified.set(jwt, { ...parent, until: Date.now() + VERIFY_TTL_MS });
    // authRefresh replaced the token in this client; requests made with it later act as the same parent.
    return parent;
  } catch {
    return null;
  }
}

export async function getParentId(): Promise<string | null> {
  return (await verifyParent(await createServerPb()))?.id ?? null;
}

export async function getParent(): Promise<Parent | null> {
  return verifyParent(await createServerPb());
}
