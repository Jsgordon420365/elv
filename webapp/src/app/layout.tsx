import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { VaultProvider } from "@/lib/VaultContext";

export const metadata: Metadata = {
  title: "ELV | Encrypted Legal Vault",
  description: "Sovereign Legal Ops - Your data, your keys.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <VaultProvider>
          {children}
        </VaultProvider>
      </body>
    </html>
  );
}
