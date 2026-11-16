import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { THEME_BOOT_SCRIPT } from "@/theme/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Maestro QA Dashboard",
  description: "Acompanhamento local de testes E2E Maestro.",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/brand/favicon.ico" },
      { url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch.png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
