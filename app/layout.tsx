import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// IMPORTS
import AppWalletProvider from "../context/AppWalletProvider"; // <--- CRITICAL
import { AuthProvider } from "../context/AuthContext";
import { UserProvider } from "../context/UserContext";
import { PlayerProvider } from "../context/PlayerContext";
import { ToastProvider } from "../context/ToastContext";
import BottomPlayer from "../components/BottomPlayer";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "IXXXI - Stream Music, Support Artists",
  description: "The next generation music platform. Stream exclusive content, support your favorite artists, and earn rewards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrains.variable} bg-black text-white antialiased`}>
        
        {/* CRITICAL: The Wallet Provider MUST wrap everything else */}
        <AppWalletProvider>
          <AuthProvider>
            <UserProvider>
              <ToastProvider>
                <PlayerProvider>
                    {/* The Main App Content */}
                    <main className="min-h-screen relative overflow-hidden">
                        {children}
                    </main>
                    
                    {/* The Sticky Footer */}
                    <BottomPlayer />
                </PlayerProvider>
              </ToastProvider>
            </UserProvider>
          </AuthProvider>
        </AppWalletProvider>

      </body>
    </html>
  );
}