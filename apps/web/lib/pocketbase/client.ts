import PocketBase from "pocketbase";
import { AUTH_COOKIE, PUBLIC_PB_URL } from "./config";

// PocketBase client for Client Components, acting as the logged-in parent (API rules apply).
// The login is kept in the pb_auth cookie so Server Components and Route Handlers see it too.
let browserClient: PocketBase | undefined;

export function createClient(): PocketBase {
  if (browserClient) return browserClient;
  const pb = new PocketBase(PUBLIC_PB_URL);
  pb.autoCancellation(false);
  if (typeof document !== "undefined") {
    pb.authStore.loadFromCookie(document.cookie, AUTH_COOKIE);
    pb.authStore.onChange(() => {
      document.cookie = pb.authStore.exportToCookie(
        { httpOnly: false, secure: location.protocol === "https:", sameSite: "Lax", path: "/" },
        AUTH_COOKIE,
      );
    });
    browserClient = pb;
  }
  return pb;
}
