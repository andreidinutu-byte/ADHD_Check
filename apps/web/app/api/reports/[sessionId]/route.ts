// Parent report download, paid once per report (D-05, D-05b, FR-48). Logic and tests in ../handlers.ts.
import type { NextRequest } from "next/server";
import { getReportPurchase, getSessionResult } from "@/lib/data/parent";
import { q } from "@/lib/pocketbase/config";
import { createServerPb, getParentId } from "@/lib/pocketbase/server";
import { renderReportPdf } from "@/lib/report";
import { handleReportDownload } from "../handlers";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/reports/[sessionId]">) {
  const { sessionId } = await ctx.params;
  const pb = await createServerPb();
  return handleReportDownload(sessionId, {
    getParentId,
    // The parent's own client: the API rules on sessions and children return nothing for another parent's
    // session or child.
    getReport: async (id) => {
      const result = await getSessionResult(pb, id);
      if (!result) return null;
      const page = await pb
        .collection("children")
        .getList(1, 1, { filter: `id = ${q(result.child_id)}`, fields: "nickname" });
      const child = page.items[0];
      return child ? { result, nickname: child.nickname as string } : null;
    },
    isReportPaid: async (id) => (await getReportPurchase(pb, id))?.status === "paid",
    renderPdf: renderReportPdf,
  });
}
