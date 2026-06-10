import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LEDGER CORE — Supply Chain Knowledge Graph",
  description: "Blockchain-based supply chain tracking with knowledge graph and AI-powered queries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased bg-navy-950 text-slate-200 min-h-screen`}>
        <Providers>
          <div className="flex min-h-screen">
            {/* Sidebar */}
            <Sidebar />
            
            {/* Main content area */}
            <div className="flex-1 flex flex-col ml-[220px]">
              <TopBar />
              <main className="flex-1 p-6">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}