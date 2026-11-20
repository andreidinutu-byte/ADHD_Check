---
name: ADHDCheck
description: Orientation tool for parents of children aged 6–12 (Warm Clinical Editorial + Twilight Windows)
colors:
  paper: "#FAF7F2"
  paper-2: "#F2ECE1"
  surface: "#FFFFFF"
  ink-primary: "#171A26"
  ink-secondary: "#4D5368"
  ink-tertiary: "#6E748A"
  brand-teal: "#0F6E66"
  brand-teal-hover: "#0B5750"
  brand-teal-soft: "#E5F4F2"
  twilight: "#131A36"
  twilight-2: "#1C264D"
  twilight-text: "#F2F5FF"
  twilight-muted: "#B6C0DF"
  lantern-warm: "#F5B841"
typography:
  display:
    fontFamily: "var(--font-editorial), Georgia, serif"
    fontSize: "3.5rem"
    fontWeight: 600
    lineHeight: 1.06
    letterSpacing: "-0.025em"
  body:
    fontFamily: "var(--font-body), system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  window: "32px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "80px"
components:
  button-primary:
    backgroundColor: "{colors.brand-teal}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.brand-teal-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
---

# Design System · ADHDCheck

## 1. Product & Design Direction
ADHDCheck is an orientation tool for parents of children aged 6–12 (a calm 10–15 min browser adventure with Luma; clear orientation results and next steps; pilot without CE mark).
The visual system adopts a hybrid concept:
* **Lumea părintelui (Parent's Reality):** Light, warm, clinical-editorial calm. High legibility, warm paper backgrounds (`#FAF7F2`), authoritative typography (`Fraunces`), and trustworthy clinical teal accents (`#0F6E66`).
* **Lumea lui Luma (Twilight Windows):** Contained nighttime windows in deep navy (`#131A36`), soft twilight surfaces (`#1C264D`), and gentle warm lantern accents (`#F5B841`).

## 2. Color Palette & Roles

### Parent Day World
* `paper: #FAF7F2` — Main canvas background for parent readability.
* `paper-2: #F2ECE1` — Subtle elevated section background and secondary containers.
* `surface: #FFFFFF` — Pristine cards on paper backgrounds.
* `ink-primary: #171A26` — High-contrast headlines and primary body text.
* `ink-secondary: #4D5368` — Secondary explanations and subtitles.
* `ink-tertiary: #6E748A` — Citations (PubMed, NHS), metadata, fine print.
* `brand-teal: #0F6E66` — Primary actions, focus rings, clinical credibility.
* `brand-teal-hover: #0B5750` — Hover state for primary buttons.
* `brand-teal-soft: #E5F4F2` — Tinted pill badges and subtle callouts.

### Luma Twilight Windows
* `twilight: #131A36` — Deep nocturnal frame background.
* `twilight-2: #1C264D` — Internal nocturnal cards.
* `twilight-text: #F2F5FF` — High-contrast text on navy.
* `twilight-muted: #B6C0DF` — Secondary nocturnal descriptions.
* `lantern-warm: #F5B841` — Warm spark for Luma and nighttime action points.

## 3. Typography Hierarchy
* **Headings (`h1`, `h2`, `h3`):** `Fraunces` (`--font-editorial`, Georgia, serif), weight `600`, tracking `-0.025em`, `text-wrap: balance`. Conveys thoughtful medical journalism and warmth.
* **Body & UI:** `Plus Jakarta Sans` (`--font-body`, system-ui, sans-serif), weight `400` / `500` / `600`, `text-wrap: pretty`, measure constrained to 45–75ch for effortless reading. Full support for Romanian diacritics (`latin-ext`: `ă, â, î, ș, ț`).

## 4. Elevation, Radii & Surfaces
* **Shadows:** Soft directional elevation (`0 1px 3px rgba(0,0,0,0.06)`, `0 10px 30px -10px rgba(19,26,54,0.12)`). Absolutely no colored zero-offset halo glows.
* **Borders:** Crisp 1px lines (`rgba(23, 26, 38, 0.10)` on light, `rgba(242, 245, 255, 0.12)` on twilight).
* **Radii:** `rounded-xl` (12px) for buttons, `rounded-2xl` (16px) for cards, `rounded-[2rem]` (32px) for twilight showcase windows.

## 5. Component Patterns
* **Primary Button:** `.btn-editorial-primary` (`#0F6E66` background, white text, subtle elevation, 200ms ease-out, no 3D inset toy shadows).
* **Secondary Button:** `.btn-editorial-secondary` (white background, 1px border `#171A26/16`, text `#171A26`, hover `#F8F5EE`).
* **Twilight Window:** `.twilight-window` (dark navy container, subtle top radial gradient `#233063 -> transparent`, 1px border).

## 6. Anti-Patterns & Craft Floor (Impeccable Strict Rules)
* **Zero Dark Glows:** No saturated yellow or cyan halos on dark cards.
* **No Day Fireflies:** Animated fireflies (`<Fireflies />`) appear **strictly** inside twilight windows, never behind parent reading text.
* **No Eyebrow Chips:** No tracked-caps pill chips floating above headlines.
* **Preserve Invariants:** `apps/web/app/content.ts`, RO/EN switch, and styles for `/parent`, `/login`, `/play` remain completely intact.
