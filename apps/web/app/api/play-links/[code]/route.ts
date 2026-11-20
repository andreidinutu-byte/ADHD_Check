// The child's device looks up its play link (FR-01). Logic and tests in ../handlers.ts.
import type { NextRequest } from "next/server";
import { createAdminPb } from "@/lib/pocketbase/admin";
import { handleResolvePlayLink } from "../handlers";
import { createPbPlayLinkStore } from "../pb-store";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/play-links/[code]">) {
  const { code } = await ctx.params;
  let admin;
  try {
    admin = await createAdminPb();
  } catch {
    console.error("[play-links] failed", { error: "storage_unavailable" });
    return Response.json({ error: "storage_unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  return handleResolvePlayLink(code, { store: createPbPlayLinkStore(admin) });
}
