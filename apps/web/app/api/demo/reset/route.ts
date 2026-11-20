// Reset demo (FR-55, FR-56). Logic and tests in ../handlers.ts.
import { createAdminPb } from "@/lib/pocketbase/admin";
import { handleDemoReset } from "../handlers";
import { seedDemo } from "../seed";
import { currentUser } from "../user";

export async function POST(request: Request) {
  return handleDemoReset(request, {
    getUser: currentUser,
    demoEmail: process.env.DEMO_PARENT_EMAIL,
    seed: async (parentId) => seedDemo(await createAdminPb(), parentId),
  });
}
