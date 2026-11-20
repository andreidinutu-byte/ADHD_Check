import { describe, expect, it } from "vitest";
import type PocketBase from "pocketbase";
import { getReportPurchase, listPendingCheckoutIds } from "./parent";

// A recording stand-in for the PocketBase client: getList is logged with its arguments and answers the items.
function fakeClient(items: unknown[]) {
  const calls: { collection: string; page: number; perPage: number; options: { filter?: string; sort?: string } }[] = [];
  const client = {
    collection: (collection: string) => ({
      getList: async (page: number, perPage: number, options: { filter?: string; sort?: string }) => {
        calls.push({ collection, page, perPage, options });
        return { items };
      },
    }),
  } as unknown as PocketBase;
  return { client, calls };
}

describe("pending purchase lookups (R4-2, R4-5)", () => {
  it("lists only pending rows, newest first, and a bounded number of them", async () => {
    const { client, calls } = fakeClient([{ stripe_checkout_session_id: "cs_1" }]);
    expect(await listPendingCheckoutIds(client, "s")).toEqual(["cs_1"]);
    const call = calls[0]!;
    expect(call.collection).toBe("report_purchases");
    expect(call.options.filter).toContain('status = "pending"');
    expect(call.options.sort).toBe("-created_at");
    expect(call.perPage).toBeLessThanOrEqual(5);
  });

  it("the purchase the parent page reads ignores failed and expired rows", async () => {
    const { client, calls } = fakeClient([{ status: "pending", emailed_at: "" }]);
    expect(await getReportPurchase(client, "s")).toEqual({ status: "pending", emailed_at: null });
    expect(calls[0]!.options.filter).toContain('(status = "pending" || status = "paid")');
  });
});
