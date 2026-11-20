// Parent deletes a child profile and all its data (FR-41). Logic and tests in ../handlers.ts.
import { ClientResponseError } from "pocketbase";
import type { NextRequest } from "next/server";
import { createServerPb, getParentId } from "@/lib/pocketbase/server";
import { handleDeleteChild } from "../handlers";

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/children/[id]">) {
  const { id } = await ctx.params;
  const pb = await createServerPb();
  return handleDeleteChild(id, {
    getParentId,
    deleteChild: async (childId) => {
      // The delete rule on children limits this to the parent's own child; 404 means not found or not theirs.
      try {
        await pb.collection("children").delete(childId);
        return true;
      } catch (e) {
        if (e instanceof ClientResponseError && e.status === 404) return false;
        throw new Error(`delete child failed: ${e instanceof Error ? e.message : "unknown"}`);
      }
    },
  });
}
