// Parent sign-up (FR-30). Logic and tests in ../handlers.ts.
import { createPbAuth } from "@/lib/pocketbase/auth";
import { handleSignUp } from "../handlers";

export async function POST(request: Request) {
  return handleSignUp(request, { auth: await createPbAuth() });
}