import PocketBase from "pocketbase";
import { AUTH_COOKIE, PUBLIC_PB_URL } from "./config";

// PocketBase client for Client Components, acting as the logged-in parent (API rules apply).
// The login is kept in the pb_auth cookie so Server Components and Route Handlers see it too.
let browserClient: PocketBase | undefined;
let lastCookie: string | undefined;

function cookieValue(): string {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${AUTH_COOKIE}=`));
  return match ?? "";
}

// One client per tab, but the cookie is re-read on every call: the login and logout routes change it on the
// server, and the page navigates without reloading (opening /parent logged out, logging in, coming back).
export function createClient(): PocketBase {
  if (typeof document === "undefined") {
    const pb = new PocketBase(PUBLIC_PB_URL);
    pb.autoCancellation(false);
    return pb;
  }
  if (!browserClient) {
    browserClient = new PocketBase(PUBLIC_PB_URL);
    browserClient.autoCancellation(false);
    const pb = browserClient;
    pb.authStore.onChange(() => {
      document.cookie = pb.authStore.exportToCookie(
        { httpOnly: false, secure: location.protocol === "https:", sameSite: "Lax", path: "/" },
        AUTH_COOKIE,
      );
      lastCookie = cookieValue();
    });
  }
  const now = cookieValue();
  if (now !== lastCookie) {
    lastCookie = now;
    browserClient.authStore.loadFromCookie(now, AUTH_COOKIE);
  }
  return browserClient;
}
