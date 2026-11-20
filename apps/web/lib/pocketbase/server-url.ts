import "server-only";
import { PUBLIC_PB_URL } from "./config";

// The server's PocketBase address: PB_URL (on the web server, the database's own address on the private
// network, which skips Cloudflare), else the public URL.
export function serverPbUrl(): string {
  return (process.env.PB_URL || PUBLIC_PB_URL).replace(/\/$/, "");
}
