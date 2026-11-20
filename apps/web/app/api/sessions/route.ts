// Game sessions from the child's device. Logic and tests live in handler.ts.
import { createAdminPb } from "@/lib/pocketbase/admin";
import { sharedRateLimiter } from "@/lib/rate-limit";
import { handleSessionPost } from "./handler";
import { createPbSessionStore } from "./pb-store";

export async function POST(request: Request) {
  let admin;
  try {
    admin = await createAdminPb();
  } catch {
    // No PocketBase admin settings (a teammate running the app with no .env.local): store nothing.
    console.error("[sessions] failed", { error: "storage_unavailable" });
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
  return handleSessionPost(request, { store: createPbSessionStore(admin), rateLimiter: sharedRateLimiter() });
}
