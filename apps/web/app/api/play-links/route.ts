// Parent creates a play link for one child (FR-01, FR-32). Logic and tests in handlers.ts.
import { createAdminPb } from "@/lib/pocketbase/admin";
import { getParentId } from "@/lib/pocketbase/server";
import { handleCreatePlayLink } from "./handlers";
import { createPbPlayLinkStore } from "./pb-store";

export async function POST(request: Request) {
  let admin;
  try {
    admin = await createAdminPb();
  } catch {
    // No PocketBase admin settings: store nothing, as /api/sessions does.
    console.error("[play-links] failed", { error: "storage_unavailable" });
    return Response.json({ error: "storage_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  // The parent id comes from the verified login cookie, never from the body.
  return handleCreatePlayLink(request, { store: createPbPlayLinkStore(admin), getParentId });
}
