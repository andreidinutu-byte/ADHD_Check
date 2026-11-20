// Email confirmation link (FR-30). Logic and tests in ../handlers.ts.
import { createPbAuth } from "@/lib/pocketbase/auth";
import { handleConfirm } from "../handlers";

export async function GET(request: Request) {
  return handleConfirm(request, { auth: await createPbAuth() });
}