import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { SessionProvider } from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "VaultPayz — Digital Bullion",
  description: "Buy, sell, gift and transfer gold & silver digitally.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <Nav />
          <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px 80px" }}>
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  );
}
