import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ToasterClient from "./components/ToasterClient";
import AuthGate from "./components/AuthGate";
import ThemeProvider from "./components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Advance Annotation System",
  description: "An advanced annotation system for managing and annotating datasets.",
  icons: {
    icon: "/app-icon.svg",
    shortcut: "/app-icon.svg",
    apple: "/app-icon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AuthGate>{children}</AuthGate>
          <ToasterClient />
        </ThemeProvider>
      </body>
    </html>
  );
}
