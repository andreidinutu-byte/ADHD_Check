---
name: ADHDCheck
description: Instrument de orientare pentru părinți de copii 6–12 ani ("Poveste de seară" / Warm Nocturnal Storybook)
colors:
  story-night: "#0B1120"
  story-night-alt: "#111A30"
  story-surface: "#172340"
  story-surface-hover: "#1E2D52"
  story-deep: "#070B14"
  story-ink: "#F7F3E8"
  story-muted: "#B4C2DF"
  story-line: "rgba(247, 243, 232, 0.12)"
  story-lantern: "#F5B841"
  story-lantern-hover: "#FFC95C"
  story-on-lantern: "#1F1400"
  story-luma: "#38C6B6"
  story-luma-soft: "rgba(56, 198, 182, 0.15)"
typography:
  display:
    fontFamily: "var(--font-storybook), var(--font-nunito), sans-serif"
    fontSize: "3.5rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  body:
    fontFamily: "var(--font-nunito), system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  frame: "28px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "88px"
components:
  button-primary:
    backgroundColor: "{colors.story-lantern}"
    textColor: "{colors.story-on-lantern}"
    rounded: "{rounded.xl}"
    padding: "14px 28px"
  button-secondary:
    backgroundColor: "rgba(247, 243, 232, 0.06)"
    textColor: "{colors.story-ink}"
    rounded: "{rounded.xl}"
    padding: "14px 28px"
---

# Design System · ADHDCheck: Poveste de seară (Warm Nocturnal Storybook)

## 1. Viziunea Produsului & Direcția Creativă
ADHDCheck este o aventură calmă de 10–15 minute pe telefon sau tabletă, desfășurată în lumea nocturnă a personajului Luma (un râu liniștit noaptea, felinare calde, licurici jucăuși). Este creat pentru copiii între 6 și 12 ani, oferind părinților la final o orientare clară și liniștitoare.

Universul **„Poveste de seară”** elimină complet:
* **Estetica rece de spital sau ziar medical:** renunțăm la serif-uri sobre de clinică și la fundaluri sterile de hârtie alb-gălbuie.
* **AI slop & SaaS-ul previzibil:** zero mov neon generic, zero glow-uri 3D ieftine, zero layout monoton centrat cu cutii simetrice de 3 coloane.

În locul lor construim o atmosferă de **carte ilustrată contemporană**:
* **Cer nocturn adânc și odihnitor:** nuanțe de bleumarin profund (`#0B1120`, `#111A30`), odihnitoare pentru privire seara când părintele citește pe telefon.
* **Căldura felinarului:** accente de galben-miere (`#F5B841`) pentru acțiunile primare (CTA) și turcoazul lui Luma (`#38C6B6`) pentru bife și stări active.
* **Text cald de pergament:** alb cald (`#F7F3E8`) cu contrast WCAG AAA (≥12:1) pentru titluri și tonuri pastelate luminate (`#B4C2DF`) pentru text secundar (WCAG AA ≥7:1).

## 2. Tipografie & Voce
* **Display / Titluri (`h1`, `h2`, `h3`):** `Bricolage Grotesque` (`--font-storybook`), greutate `700`, `tracking: -0.02em`, `text-wrap: balance`. Oferă o personalitate caldă, craft grafic francez, un aer de basm modern fără a cădea în derizoriu sau desene animate ieftine. Include suport nativ complet `latin-ext` pentru diacritice românești (`ă, â, î, ș, ț`).
* **Body & Interfață:** `Nunito` (`--font-nunito`), greutate `400` / `600`, `text-wrap: pretty`, coloane de lectură calibrate la 45–70ch. Terminațiile rotunjite transmit blândețe și empatie, menținând în același timp o lizibilitate de top pe fundal întunecat.

## 3. Paletă Cromatică & Roluri Semantice
* `story-night: #0B1120` — Pânza principală a nopții.
* `story-night-alt: #111A30` — Secțiuni alternate pentru ritm vizual la scroll.
* `story-surface: #172340` — Carduri și containere tactile pe un singur nivel (fără carduri imbricate).
* `story-surface-hover: #1E2D52` — Stare hover pentru carduri interactive.
* `story-deep: #070B14` — Footer nocturn adânc.
* `story-ink: #F7F3E8` — Titluri și text principal (contrast 12:1+).
* `story-muted: #B4C2DF` — Descrieri și detalii secundare (contrast WCAG AA 7.2:1).
* `story-line: rgba(247, 243, 232, 0.12)` — Borduri fine de delimitare (1px).
* `story-lantern: #F5B841` — Felinarul cald: singurul punct de atracție pentru CTA primar.
* `story-lantern-hover: #FFC95C` — Hover cald pentru CTA primar.
* `story-on-lantern: #1F1400` — Text întunecat cu contrast ridicat (≥11:1) pe felinar.
* `story-luma: #38C6B6` — Turcoazul lui Luma pentru bife de încredere, indicatori activi și badge-uri.
* `story-luma-soft: rgba(56, 198, 182, 0.15)` — Fundaluri discrete pentru badge-uri.

## 4. Ritm Structural & Eliminarea Template-ului SaaS
Fiecare secțiune este gândită asimetric, ca o filă dintr-o carte:
1. **Hero:** Layout centrat primitor și aerisit. Titlul călduros în `Bricolage Grotesque`, subtitlul relaxant în `Nunito`, butoanele CTA (felinar primar + nocturn secundar), bifele cu Luma și pilot note centrate sus; dedesubt rama nocturnă de poveste (`rounded-[2rem]`) cu compoziția jocului (`treasure-choice-play.jpg` pe tabletă + `bridge-wait-portrait.jpg` pe telefon) optic centrată, fără margini tăiate și fără a acoperi personajul Luma. Fără `[radial-halo]`, fără `blur-3xl`, cu licurici discret plasați strict pe marginile exterioare.
2. **Problem:** Flux editorial asimetric. Stânga ancorată sticky (`lg:sticky lg:top-24`) cu mesajul central și punchline-ul; dreapta cu citatele părinților ca flux curat și statistici prezentate ca numere monumentale, fără cutii albe generice.
3. **How:** Capitole de aventură legate într-un fir narativ continuu, nu 3 cutii paralele copiate din SaaS.
4. **Game:** Scenă interactivă master-detail (`useState(0)`). Ecran mare pentru jocul selectat + catalogul celor 4 aventuri cu Luma în dreapta.
5. **Result & Privacy:** Structură echilibrată, eliminând găurile asimetrice (precum vechea grilă 3+2 din Privacy).
6. **Final & Footer:** Încheiere caldă de seară, cu licurici discret plasați exclusiv pe marginile ecranului și CTA de acces gratuit vizibil instantaneu.
