import type { Metadata, Viewport } from "next";
import { Fraunces, Fredoka, Nunito, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-editorial",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "ADHDCheck · Dă-i telefonul. Primești un pas următor clar.",
  description:
    "Un joc liniștit de 10–15 minute cu Luma, pentru copii de 6–12 ani. La final afli dacă merită să vorbești cu un specialist despre atenția și concentrarea copilului. Nu este un diagnostic.",
  openGraph: {
    title: "ADHDCheck",
    description:
      "Un joc de 10–15 minute care te ajută să decizi dacă merită să vorbești cu un specialist. Pentru părinții copiilor de 6–12 ani. Pilot, fără marcaj CE.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning applies to this element's own attributes only ("only works one level deep",
    // react.dev hydrateRoot): browser extensions add attributes to <html> before React hydrates.
    <html
      lang="ro"
      className={`${fredoka.variable} ${nunito.variable} ${fraunces.variable} ${plusJakartaSans.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
