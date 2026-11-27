import type { Metadata } from "next";
import { Anton, Archivo, Bebas_Neue, Permanent_Marker } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/context/toast-context";
import { CartProvider } from "@/context/cart-context";

const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton" });
const marker = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--font-marker" });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-bebas" });
const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-archivo" });

// How long a page may take to build before the host gives up on it. A sleeping database can need ~20s to
// wake and the connection retries (src/lib/db-resilience.ts) are built to wait that long; with a shorter
// limit the host would cut the request off first and the visitor would see a bare timeout page instead of
// the shop's own "Warming up…" retry page. (Pages that finish in milliseconds are not affected.)
export const maxDuration = 60;

export const metadata: Metadata = {
  title: {
    default: "Inverted Crayon — Made to stand out.",
    template: "%s · Inverted Crayon",
  },
  description: "Streetwear made for disruptors. Bold. Unfiltered. Inverted.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${marker.variable} ${bebas.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-ink text-paper">
        <ToastProvider>
          <CartProvider>{children}</CartProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
