"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type PocketBase from "pocketbase";
// Relative import: the tests render a card that uses this file, and Vitest has no "@/" alias.
import { createClient } from "../../../lib/pocketbase/client";
import { loginPathFor } from "../../../lib/safe-next";
import { S } from "../strings";

// Parent pages run in the browser with the parent's own PocketBase client (API rules return only their rows).
// No session: to /login, carrying this page, so the login returns here (a link in the report email lands on the
// right child and report after login).
export function useParent(): { client: PocketBase; ready: boolean } {
  const client = useMemo(() => createClient(), []);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const toLogin = () => router.replace(loginPathFor(window.location.pathname + window.location.search));
    // authRefresh asks PocketBase whether the stored login is still good (and renews it, so an active parent
    // stays logged in); an expired or revoked login is cleared and the parent goes to /login.
    const check = client.authStore.isValid
      ? client.collection("users").authRefresh().then(() => true, () => (client.authStore.clear(), false))
      : Promise.resolve(false);
    void check.then((ok) => {
      if (!live) return;
      if (ok) setReady(true);
      else toLogin();
    });
    return () => {
      live = false;
    };
  }, [client, router]);
  return { client, ready };
}

export async function postJson(url: string, body: unknown = {}) {
  return fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const client = useMemo(() => createClient(), []);
  return (
    <div className="min-h-dvh bg-cream text-ink">
      <header className="bg-night text-moon">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/parent" className="flex items-center gap-2 rounded-lg font-display text-lg font-semibold focus-visible:outline-2 focus-visible:outline-glow">
            <span aria-hidden="true" className="size-3 rounded-full bg-glow shadow-[0_0_14px_4px_rgb(251_191_36/0.7)]" />
            {S.appName}
          </Link>
          <button
            type="button"
            onClick={async () => {
              await postJson("/api/auth/logout");
              client.authStore.clear();
              router.replace("/login");
            }}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-moon-muted hover:text-moon focus-visible:outline-2 focus-visible:outline-glow"
          >
            {S.nav.logout}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_1px_0_rgb(31_27_58/0.06),0_8px_24px_rgb(31_27_58/0.06)] sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export const buttonPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-glow px-5 font-semibold text-on-glow hover:bg-glow-strong disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
export const buttonQuiet =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-ink/15 bg-white px-4 font-semibold text-ink hover:bg-cream-2 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
export const field =
  "min-h-11 w-full rounded-xl border border-ink/20 bg-white px-3 text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-glow-strong";

export function Loading() {
  return <p className="py-10 text-center text-ink-muted">{S.loading}</p>;
}

export function ErrorNote() {
  return <p role="alert" className="rounded-xl bg-berry-soft px-4 py-3 text-ink">{S.error}</p>;
}
