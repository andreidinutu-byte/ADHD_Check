// PocketBase address for the browser (public). The server may use a closer one: lib/pocketbase/server-url.ts.
export const PUBLIC_PB_URL = (process.env.NEXT_PUBLIC_PB_URL || "https://unihub-db.andreidobrin.com").replace(/\/$/, "");

// The parent's login lives in this cookie, written by the PocketBase SDK format (token + user record).
// It is readable by browser code on purpose: Client Components talk to PocketBase directly with it, and
// PocketBase API rules (pocketbase/schema.json) decide what each parent may read and write.
export const AUTH_COOKIE = "pb_auth";

// PocketBase stores dates as "YYYY-MM-DD HH:MM:SS.sssZ". Pages and contracts use ISO 8601.
export function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.includes("T") ? value : value.replace(" ", "T");
}

// Escape a value for a PocketBase filter string literal.
export function q(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
