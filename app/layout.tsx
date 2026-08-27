import type { Metadata } from "next";
import Script from "next/script";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { BootOverlay } from "@/components/BootOverlay";
import "./globals.css";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Commitdex: a pokedex for commit messages",
  description:
    "Paste a git commit message, get roasted, and print a collectible creature card.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jetbrains.variable} ${bricolage.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <Script id="commitdex-boot" strategy="beforeInteractive">
          {`try{if(!sessionStorage.getItem("commitdex-booted")&&!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.dataset.boot="pending"}catch(e){}`}
        </Script>
        <BootOverlay />
        {children}
      </body>
    </html>
  );
}
