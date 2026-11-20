"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { content, type Dict, type Lang } from "../content";
import { Fireflies } from "./Fireflies";
import { Arrow, Check, Compass, Play, Plus, Shield } from "./icons";

const LANG_KEY = "adhdcheck.lang";

// Language lives in localStorage (with an in-memory fallback when storage is blocked).
// The server always renders Romanian; the client switches after hydration if needed.
const langListeners = new Set<() => void>();
let memLang: Lang | null = null;

function readLang(): Lang {
  if (memLang) return memLang;
  try {
    return localStorage.getItem(LANG_KEY) === "en" ? "en" : "ro";
  } catch {
    return "ro";
  }
}

function writeLang(l: Lang) {
  memLang = l;
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {}
  langListeners.forEach((f) => f());
}

function subscribeLang(cb: () => void) {
  langListeners.add(cb);
  return () => {
    langListeners.delete(cb);
  };
}

export function Landing() {
  const lang = useSyncExternalStore(subscribeLang, readLang, () => "ro" as Lang);
  const t = content[lang];

  useEffect(() => {
    document.documentElement.classList.add("js");
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useReveal(lang);

  return (
    <div className="landing-theme min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-story-luma focus:px-4 focus:py-2 focus:text-story-night focus:shadow-md font-semibold"
      >
        {t.meta.skip}
      </a>
      <Header t={t} lang={lang} setLang={writeLang} />
      <main id="main">
        <Hero t={t} />
        <Problem t={t} />
        <How t={t} />
        <Game t={t} />
        <Result t={t} />
        <Offer t={t} />
        <Privacy t={t} />
        <Faq t={t} />
        <Final t={t} lang={lang} />
      </main>
      <Footer t={t} />
      <StickyCta t={t} />
    </div>
  );
}

/* ---------- hooks ---------- */

// Re-runs on language change so any element React re-created is observed again.
function useReveal(lang: Lang) {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -10% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [lang]);
}

/* ---------- shared bits ---------- */

function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

function Kicker({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <p className={`mb-3 text-sm font-bold tracking-wide sm:text-base ${dark ? "text-story-luma" : "text-brand-teal"}`}>
      {children}
    </p>
  );
}

function H2({ children, className = "", dark = false }: { children: ReactNode; className?: string; dark?: boolean }) {
  return (
    <h2
      className={`font-storybook text-3xl font-bold leading-tight sm:text-4xl md:text-5xl text-balance ${
        dark ? "text-story-ink" : "text-ink-primary"
      } ${className}`}
    >
      {children}
    </h2>
  );
}

function CtaButton({
  children,
  className = "",
  variant = "editorial",
}: {
  children: ReactNode;
  className?: string;
  variant?: "editorial" | "lantern";
}) {
  return (
    <a
      href="#start"
      className={`btn-story-primary inline-flex min-h-13 cursor-pointer items-center justify-center gap-2.5 rounded-xl px-7 py-3 text-base font-bold shadow-xs ${className}`}
    >
      {children}
      <Arrow className="size-4" />
    </a>
  );
}

function PilotNote({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-story-line bg-story-surface px-3.5 py-1.5 text-xs font-semibold text-story-muted">
      <span className="size-2 rounded-full bg-story-luma" aria-hidden="true" />
      {children}
    </p>
  );
}

/* ---------- header ---------- */

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <a href="#main" className="group flex items-center gap-2.5" aria-label="ADHDCheck">
      <span className="relative flex size-8 items-center justify-center rounded-xl border border-story-line bg-story-surface shadow-xs transition-colors group-hover:border-story-lantern/40">
        <svg viewBox="0 0 20 20" fill="none" className="size-4 text-story-ink" aria-hidden="true">
          <path d="M10 2C9.4 2 9 2.4 9 3V4H11V3C11 2.4 10.6 2 10 2Z" fill="currentColor" />
          <path
            d="M6 7C6 5.3 7.8 4 10 4C12.2 4 14 5.3 14 7V13C14 15 12 16.5 10 16.5C8 16.5 6 15 6 13V7Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="10" cy="10" r="2.2" className="fill-story-lantern" />
        </svg>
      </span>
      <span className="font-storybook text-xl font-bold tracking-tight text-story-ink">
        ADHD<span className="text-story-lantern">Check</span>
      </span>
    </a>
  );
}

function LangToggle({ lang, setLang, label }: { lang: Lang; setLang: (l: Lang) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-xl border border-story-line bg-story-surface p-1">
      {(["ro", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`min-h-10 min-w-11 cursor-pointer rounded-lg px-3 text-xs font-bold uppercase tracking-wider transition-all ${
            lang === l
              ? "border border-story-line bg-story-night-alt text-story-ink shadow-xs"
              : "text-story-muted hover:text-story-ink"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Header({ t, lang, setLang }: { t: Dict; lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <header className="sticky top-0 z-50 border-b border-story-line bg-story-night/90 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-3">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-7 text-sm font-semibold text-story-muted lg:flex">
          <a className="transition-colors hover:text-story-ink" href="#how">{t.nav.how}</a>
          <a className="transition-colors hover:text-story-ink" href="#offer">{t.nav.offer}</a>
          <a className="transition-colors hover:text-story-ink" href="#privacy">{t.nav.privacy}</a>
          <a className="transition-colors hover:text-story-ink" href="#faq">{t.nav.faq}</a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LangToggle lang={lang} setLang={setLang} label={t.nav.langLabel} />
          <a
            href="/login"
            className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-story-muted transition-colors hover:text-story-ink sm:px-3"
          >
            {t.nav.login}
          </a>
          <a
            href="#start"
            className="btn-story-primary hidden min-h-10 items-center rounded-xl px-5 text-sm font-bold sm:inline-flex"
          >
            {t.nav.cta}
          </a>
        </div>
      </Container>
    </header>
  );
}

/* ---------- hero ---------- */

function Hero({ t }: { t: Dict }) {
  return (
    <section id="hero" className="relative overflow-hidden bg-story-night pb-16 pt-8 sm:pt-14 md:pb-24">
      <Fireflies count={6} />
      <Container className="relative z-10 text-center">
        <p className="text-sm font-semibold tracking-wide text-story-luma sm:text-base">{t.hero.eyebrow}</p>

        <h1 className="mx-auto mt-4 max-w-4xl font-storybook text-4xl font-bold leading-[1.08] tracking-tight text-story-ink sm:text-5xl md:text-6xl lg:text-7xl text-balance">
          {t.hero.title}
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-story-muted sm:text-lg md:text-xl text-pretty">
          {t.hero.sub}
        </p>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-3.5 sm:flex-row sm:items-center">
          <CtaButton>{t.hero.cta}</CtaButton>
          <a
            href="#how"
            className="btn-story-secondary inline-flex min-h-13 cursor-pointer items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold shadow-xs"
          >
            <Play className="size-4 text-story-luma" />
            {t.hero.secondary}
          </a>
        </div>

        <ul className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold text-story-muted">
          {t.hero.trust.map((x) => (
            <li key={x} className="flex items-center gap-2">
              <Check className="size-4 text-story-luma" />
              <span>{x}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5">
          <PilotNote>{t.hero.pilot}</PilotNote>
        </div>

        <div className="relative mx-auto mt-12 max-w-5xl overflow-hidden rounded-[2rem] border border-story-line bg-story-surface p-5 shadow-2xl sm:p-7 md:mt-16 md:p-9 lg:p-11">
          <div className="relative mx-auto w-full md:max-w-[88%] lg:max-w-[86%]">
            {/* Tablet Landscape - visible from md upwards */}
            <div className="relative hidden overflow-hidden rounded-[1.75rem] border-[6px] border-story-night-alt shadow-2xl md:block md:w-[78%] lg:w-[80%]">
              <Image
                src="/landing/treasure-choice-play.jpg"
                alt=""
                width={2400}
                height={1600}
                sizes="(min-width: 768px) 55vw, 0px"
                className="block h-auto w-full object-cover"
                priority
              />
            </div>

            {/* Phone Portrait - centered on mobile, positioned bottom-right on tablet/desktop */}
            <div className="relative mx-auto w-[68%] max-w-[240px] overflow-hidden rounded-[2.2rem] border-[6px] border-story-night-alt shadow-2xl md:absolute md:bottom-2 md:right-0 lg:bottom-4 md:w-[26%] lg:w-[25%]">
              <Image
                src="/landing/bridge-wait-portrait.jpg"
                alt={t.hero.imgAlt}
                width={860}
                height={1640}
                sizes="(min-width: 768px) 25vw, 68vw"
                className="block h-auto w-full object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---------- problem ---------- */

function Problem({ t }: { t: Dict }) {
  return (
    <section id="problem" className="relative border-y border-story-line bg-story-night-alt py-20 text-story-ink md:py-28">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16 items-start">
          {/* Left Column - Sticky on desktop */}
          <div className="reveal lg:sticky lg:top-24 space-y-6">
            <div>
              <Kicker dark>{t.problem.kicker}</Kicker>
              <H2 dark className="text-balance">{t.problem.title}</H2>
            </div>
            <div className="border-l-2 border-story-luma pl-5 py-1">
              <p className="font-storybook text-xl font-bold leading-snug text-story-ink text-balance sm:text-2xl">
                {t.problem.punch}
              </p>
            </div>
          </div>

          {/* Right Column - Editorial Stream + Monumental Stats */}
          <div className="space-y-12">
            {/* Parent Quotes */}
            <ul className="space-y-6">
              {t.problem.items.map((item, i) => (
                <li
                  key={i}
                  className="reveal border-t border-story-line pt-5 flex items-start gap-4"
                >
                  <span className="font-mono text-xs font-bold text-story-luma/80 shrink-0 pt-1">
                    0{i + 1}
                  </span>
                  <p className="text-base sm:text-lg leading-relaxed text-story-muted text-pretty">
                    “{item}”
                  </p>
                </li>
              ))}
            </ul>

            {/* Research Stats */}
            <div className="reveal pt-4">
              <p className="text-sm font-bold uppercase tracking-wider text-story-luma">
                {t.problem.statsIntro}
              </p>
              <div className="mt-6 grid gap-8 border-y border-story-line py-8 md:grid-cols-2 md:divide-x md:divide-story-line">
                {t.problem.stats.map((s, i) => (
                  <figure
                    key={i}
                    className={`flex flex-col justify-between ${i > 0 ? "md:pl-8" : "md:pr-8"}`}
                  >
                    <div>
                      <p className="font-storybook text-5xl font-bold tabular-nums text-story-lantern sm:text-6xl">
                        {s.value}
                      </p>
                      <p className="mt-3 text-base sm:text-lg leading-relaxed text-story-ink text-pretty">
                        {s.label}
                      </p>
                    </div>
                    <figcaption className="mt-6 text-xs leading-normal text-story-muted/80">
                      {s.source}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---------- how it works ---------- */

function How({ t }: { t: Dict }) {
  return (
    <section id="how" className="relative bg-story-night py-20 text-story-ink md:py-28">
      <Container className="relative">
        <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          {/* Left Column: Heading + Story chapters */}
          <div className="reveal space-y-8">
            <div>
              <Kicker dark>{t.how.kicker}</Kicker>
              <H2 dark className="text-balance">{t.how.title}</H2>
            </div>
            <ol className="relative space-y-8 before:absolute before:left-5 before:top-4 before:bottom-4 before:w-px before:bg-story-line">
              {t.how.steps.map((s, i) => (
                <li key={i} className="relative flex items-start gap-5">
                  <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-xl border border-story-line bg-story-surface font-storybook text-base font-bold text-story-lantern shadow-xs">
                    0{i + 1}
                  </span>
                  <div className="pt-0.5">
                    <h3 className="font-storybook text-xl font-bold text-story-ink sm:text-2xl">
                      {s.title}
                      <span className="ml-3 inline-block rounded-full border border-story-line bg-story-surface px-2.5 py-0.5 align-middle text-xs font-semibold text-story-luma">
                        {s.time}
                      </span>
                    </h3>
                    <p className="mt-2 max-w-xl text-base leading-relaxed text-story-muted sm:text-lg text-pretty">
                      {s.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Right Column: Handback moment */}
          <figure className="reveal mx-auto w-full max-w-md lg:mt-6">
            <figcaption className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-story-luma">
              {t.how.handbackLabel}
            </figcaption>
            <div className="relative overflow-hidden rounded-[2rem] border border-story-line bg-story-surface p-4 shadow-2xl">
              <div className="overflow-hidden rounded-2xl border border-story-line/60">
                <Image
                  src="/landing/treasure-choice-wide.jpg"
                  alt=""
                  width={2400}
                  height={1600}
                  sizes="(min-width: 1024px) 26rem, 90vw"
                  className="block aspect-[4/3] h-auto w-full object-cover object-[50%_40%]"
                />
              </div>
              <div className="pt-4 text-center">
                <p className="font-storybook text-base font-bold leading-snug text-story-ink sm:text-lg text-pretty">
                  “{t.how.handback}”
                </p>
              </div>
            </div>
          </figure>
        </div>
      </Container>
    </section>
  );
}

/* ---------- game ---------- */

function Game({ t }: { t: Dict }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeGame = t.game.games[activeIdx] ?? t.game.games[0];
  const isPortrait = activeGame.img?.includes("portrait") || activeGame.img?.includes("bridge-wait");

  return (
    <section id="game" className="relative overflow-hidden bg-story-night-alt py-20 text-story-ink md:py-28">
      <Fireflies count={6} />
      <Container className="relative z-10">
        <div className="reveal max-w-3xl">
          <Kicker dark>{t.game.kicker}</Kicker>
          <H2 dark className="text-balance">{t.game.title}</H2>
          <p className="mt-4 text-base leading-relaxed text-story-muted sm:text-lg text-pretty">
            {t.game.sub}
          </p>
        </div>

        {/* Master-Detail Stage */}
        <div className="mt-12 grid gap-8 lg:grid-cols-[1.25fr_0.75fr] items-stretch">
          {/* Big Stage (Screen) */}
          <div className="reveal flex flex-col justify-between rounded-[2rem] border border-story-line bg-story-surface p-5 shadow-2xl sm:p-6">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-story-line/60 bg-story-night">
              {activeGame.img ? (
                isPortrait ? (
                  <div className="relative flex size-full items-center justify-center p-3 sm:p-4">
                    <div className="relative h-full aspect-[9/16] max-h-[360px] overflow-hidden rounded-[1.75rem] border-4 border-story-line/80 bg-story-night shadow-xl">
                      <Image
                        src={activeGame.img}
                        alt={activeGame.what}
                        width={860}
                        height={1640}
                        sizes="(min-width: 1024px) 25vw, 60vw"
                        className="block size-full object-cover"
                      />
                    </div>
                  </div>
                ) : (
                  <Image
                    src={activeGame.img}
                    alt={activeGame.what}
                    width={2400}
                    height={1600}
                    sizes="(min-width: 1024px) 50vw, 90vw"
                    className="block size-full object-cover"
                  />
                )
              ) : (
                <div className="grid size-full place-items-center bg-story-night text-story-luma" aria-hidden="true">
                  <Compass className="size-16" />
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <div>
                <h3 className="font-storybook text-2xl font-bold text-story-ink sm:text-3xl">
                  {activeGame.name}
                </h3>
                <p className="mt-1 text-base text-story-muted text-pretty">
                  {activeGame.what}
                </p>
              </div>
              <span className="mt-2 text-xs font-bold uppercase tracking-wider text-story-luma shrink-0 sm:mt-0">
                {activeIdx + 1} / {t.game.games.length}
              </span>
            </div>
          </div>

          {/* Adventure Selector (Right side tablist) */}
          <div role="tablist" aria-label={t.game.title} className="reveal flex flex-col gap-3 justify-center">
            {t.game.games.map((g, i) => {
              const isActive = activeIdx === i;
              return (
                <button
                  key={g.name}
                  type="button"
                  role="tab"
                  id={`tab-${i}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${i}`}
                  onClick={() => setActiveIdx(i)}
                  className={`group flex items-center gap-4 rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                    isActive
                      ? "border-story-lantern bg-story-surface shadow-md ring-1 ring-story-lantern/40"
                      : "border-story-line bg-story-surface/40 hover:bg-story-surface hover:border-story-line/80"
                  }`}
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl font-storybook text-sm font-bold transition-colors ${
                      isActive
                        ? "bg-story-lantern text-story-on-lantern"
                        : "border border-story-line bg-story-night text-story-muted group-hover:text-story-ink"
                    }`}
                  >
                    0{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-storybook text-lg font-bold truncate transition-colors ${
                        isActive ? "text-story-ink" : "text-story-muted group-hover:text-story-ink"
                      }`}
                    >
                      {g.name}
                    </p>
                    <p className="mt-0.5 text-xs text-story-muted/80 truncate">
                      {g.what}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Core dev note */}
        <div className="reveal mt-10 inline-flex flex-wrap items-center gap-3 rounded-2xl border border-story-line bg-story-surface px-4 py-3 text-sm text-story-muted">
          <span className="rounded-lg border border-story-lantern/30 bg-story-lantern/15 px-2.5 py-1 text-xs font-bold text-story-lantern">
            {t.game.coreLabel}
          </span>
          <span className="leading-relaxed">{t.game.core}</span>
        </div>

        {/* Calm commitments */}
        <ul className="reveal mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-story-line pt-8 text-sm font-semibold text-story-muted">
          {t.game.calm.map((c) => (
            <li key={c} className="flex items-center gap-2.5">
              <Check className="size-4 text-story-luma shrink-0" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* ---------- result preview ---------- */

function Result({ t }: { t: Dict }) {
  return (
    <section id="result" className="relative bg-paper py-20 text-ink-primary md:py-28">
      <Container className="grid items-start gap-12 md:grid-cols-2 md:items-center">
        <div className="reveal">
          <Kicker>{t.result.kicker}</Kicker>
          <H2>{t.result.title}</H2>
          <p className="mt-5 text-lg leading-relaxed text-ink-secondary text-pretty">{t.result.sub}</p>
        </div>
        <div className="reveal space-y-4">
          {[t.result.a, t.result.b].map((h) => (
            <div key={h} className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-5 shadow-xs">
              <Compass className="mt-1 size-5 shrink-0 text-brand-teal" />
              <p className="font-editorial text-lg font-semibold leading-snug text-ink-primary md:text-xl">{h}</p>
            </div>
          ))}
          <div className="flex items-start gap-4 rounded-2xl border border-brand-teal/25 bg-brand-teal-soft p-5">
            <Arrow className="mt-1 size-5 shrink-0 text-brand-teal" />
            <p className="text-base leading-relaxed text-ink-primary md:text-lg text-pretty">{t.result.next}</p>
          </div>
          <div className="rounded-xl border border-line bg-paper-2 px-4 py-3 text-sm font-medium text-ink-secondary">
            <p>{t.result.disclaimer}</p>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---------- offer: free vs paid ---------- */

function Offer({ t }: { t: Dict }) {
  const { free, paid } = t.offer;
  return (
    <section id="offer" className="relative border-y border-line bg-paper-2 py-20 text-ink-primary md:py-28">
      <Container>
        <div className="reveal max-w-3xl">
          <Kicker>{t.offer.kicker}</Kicker>
          <H2>{t.offer.title}</H2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <article className="reveal flex flex-col justify-between rounded-2xl border border-line bg-surface p-7 shadow-xs">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-teal">{free.label}</p>
              <p className="mt-2 font-editorial text-4xl font-semibold tabular-nums text-ink-primary md:text-5xl">{free.price}</p>
              <ul className="mt-6 space-y-3.5">
                {free.items.map((it) => (
                  <li key={it} className="flex items-start gap-3 text-base text-ink-primary">
                    <Check className="mt-1 size-4 shrink-0 text-brand-teal" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
          <article className="reveal flex flex-col justify-between rounded-2xl border-2 border-brand-teal bg-surface p-7 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-teal">{paid.label}</p>
              <p className="mt-2 font-editorial text-4xl font-semibold tabular-nums text-ink-primary md:text-5xl">{paid.price}</p>
              <p className="mt-1 text-xs font-medium text-ink-secondary">{paid.priceNote}</p>
              <ul className="mt-6 space-y-3.5">
                {paid.items.map((it) => (
                  <li key={it} className="flex items-start gap-3 text-base text-ink-primary">
                    <Check className="mt-1 size-4 shrink-0 text-brand-teal" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </div>
        <div className="reveal mt-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-3 text-sm font-medium text-ink-secondary">
            <Shield className="size-5 shrink-0 text-brand-teal" />
            <span>{t.offer.note}</span>
          </p>
          <CtaButton className="w-full sm:w-auto">{t.offer.cta}</CtaButton>
        </div>
      </Container>
    </section>
  );
}

/* ---------- privacy ---------- */

function Privacy({ t }: { t: Dict }) {
  return (
    <section id="privacy" className="relative bg-paper py-20 text-ink-primary md:py-28">
      <Container>
        <div className="reveal max-w-3xl">
          <Kicker>{t.privacy.kicker}</Kicker>
          <H2>{t.privacy.title}</H2>
        </div>
        <dl className="mt-12 grid gap-x-12 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {t.privacy.items.map((p) => (
            <div key={p.title} className="reveal border-t border-line pt-5">
              <dt className="flex items-center gap-2.5 font-editorial text-lg font-semibold text-ink-primary">
                <Shield className="size-5 shrink-0 text-brand-teal" />
                <span>{p.title}</span>
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-ink-secondary text-pretty">{p.body}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

/* ---------- FAQ ---------- */

function Faq({ t }: { t: Dict }) {
  return (
    <section id="faq" className="relative border-y border-line bg-paper-2 py-20 text-ink-primary md:py-28">
      <Container className="max-w-3xl">
        <div className="reveal">
          <Kicker>{t.faq.kicker}</Kicker>
          <H2>{t.faq.title}</H2>
        </div>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {t.faq.items.map((f, i) => (
            <details key={i} className="group [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-editorial text-lg font-semibold text-ink-primary transition-colors hover:text-brand-teal focus-visible:outline-2 focus-visible:outline-brand-teal">
                <span>{f.q}</span>
                <Plus className="size-5 shrink-0 text-brand-teal transition-transform duration-200 group-open:rotate-45" />
              </summary>
              <p className="pb-6 text-base leading-relaxed text-ink-secondary text-pretty">{f.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ---------- final CTA + waitlist ---------- */

function Final({ t, lang }: { t: Dict; lang: Lang }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "ok" | "invalid" | "fail">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setState("invalid");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, lang }),
      });
      setState(res.ok ? "ok" : res.status === 400 ? "invalid" : "fail");
    } catch {
      setState("fail");
    }
  }

  const msg =
    state === "ok" ? t.final.formSuccess : state === "invalid" ? t.final.formError : state === "fail" ? t.final.formFail : null;

  return (
    <section id="start" className="relative overflow-hidden bg-twilight py-20 text-twilight-text md:py-28">
      <Fireflies count={6} />
      <Container className="relative z-10 max-w-3xl text-center">
        <H2 dark className="md:text-5xl lg:text-6xl text-balance">{t.final.title}</H2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-twilight-muted text-pretty">{t.final.sub}</p>

        {state === "ok" ? (
          <p role="status" className="mx-auto mt-10 max-w-xl rounded-2xl border border-white/20 bg-twilight-2 p-5 font-semibold text-twilight-text">
            {msg}
          </p>
        ) : (
          <form onSubmit={submit} noValidate className="mx-auto mt-10 max-w-xl text-left">
            <label htmlFor="email" className="mb-2 block text-sm font-semibold text-twilight-text">
              {t.final.formLabel}
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (state !== "idle" && state !== "sending") setState("idle");
                }}
                placeholder={t.final.formPlaceholder}
                aria-invalid={state === "invalid"}
                aria-describedby="email-help email-consent"
                className="min-h-13 flex-1 rounded-xl border border-white/20 bg-twilight-2 px-5 text-base text-twilight-text placeholder:text-twilight-muted focus:border-lantern-warm focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={state === "sending"}
                className="btn-editorial-lantern min-h-13 cursor-pointer rounded-xl px-7 text-base font-semibold whitespace-nowrap shrink-0 bg-lantern-warm text-on-lantern disabled:cursor-wait disabled:opacity-60"
              >
                {state === "sending" ? t.final.sending : t.final.formCta}
              </button>
            </div>
            <p id="email-help" aria-live="polite" className={`mt-3 text-sm ${msg ? "font-semibold text-lantern-warm" : "text-twilight-muted"}`}>
              {msg ?? t.final.formNote}
            </p>
            <p id="email-consent" className="mt-3 text-xs leading-relaxed text-twilight-muted/90">
              {t.final.consent}
            </p>
          </form>
        )}
      </Container>
    </section>
  );
}

/* ---------- footer + sticky mobile CTA ---------- */

function Footer({ t }: { t: Dict }) {
  return (
    <footer className="border-t border-white/10 bg-twilight-deep pb-28 pt-14 text-sm text-twilight-muted md:pb-14">
      <Container className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
        <div className="space-y-4">
          <Logo dark />
          <p className="font-semibold text-twilight-text">{t.footer.pilot}</p>
          <p className="max-w-md leading-relaxed text-twilight-muted text-pretty">
            {t.footer.disclaimer}
          </p>
        </div>
        <div className="flex flex-col gap-6 md:items-end">
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-twilight-muted">
            <a className="transition-colors hover:text-twilight-text" href="#how">{t.nav.how}</a>
            <a className="transition-colors hover:text-twilight-text" href="#offer">{t.nav.offer}</a>
            <a className="transition-colors hover:text-twilight-text" href="#privacy">{t.nav.privacy}</a>
            <a className="transition-colors hover:text-twilight-text" href="#faq">{t.nav.faq}</a>
            <a className="transition-colors hover:text-twilight-text" href="/login">{t.nav.login}</a>
          </nav>
          <p className="text-xs text-twilight-muted/90 md:text-right">{t.footer.event}</p>
        </div>
      </Container>
    </footer>
  );
}

function StickyCta({ t }: { t: Dict }) {
  const [show, setShow] = useState(false);
  const seen = useRef({ hero: true, final: false });

  useEffect(() => {
    const hero = document.getElementById("hero");
    const final = document.getElementById("start");
    if (!hero || !final || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.target === hero) seen.current.hero = e.isIntersecting;
        if (e.target === final) seen.current.final = e.isIntersecting;
      });
      setShow(!seen.current.hero && !seen.current.final);
    });
    io.observe(hero);
    io.observe(final);
    return () => io.disconnect();
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 p-3 backdrop-blur-md transition-transform duration-300 md:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!show}
    >
      <a
        href="#start"
        tabIndex={show ? 0 : -1}
        className="btn-editorial-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold shadow-md"
      >
        {t.sticky}
        <Arrow className="size-5" />
      </a>
    </div>
  );
}
