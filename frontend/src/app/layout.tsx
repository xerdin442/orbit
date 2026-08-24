import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import "@/lib/fontawesome";
import { Providers } from "@/components/providers";
import { AuthCallback } from "@/components/auth/callback";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Orbit",
  description: "A better way to ship software.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
    >
      <body className="h-dvh flex flex-col custom-scrollbar">
        <Providers>
          <Suspense>
            <AuthCallback>{children}</AuthCallback>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
